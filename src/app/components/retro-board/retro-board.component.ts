import { map } from 'rxjs/operators';
import { Component, OnInit, OnDestroy, TemplateRef } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/database';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { Subject } from 'rxjs/Subject';
import { MatDialog, MatDialogRef } from '@angular/material';
import { takeUntil } from 'rxjs/operators';
import { RetroboardDetailsModalComponent } from '../retro-board-details-modal/retro-board-details-modal.component';
import { ExportService } from '../../services/export.service';
import { AuthService } from '../../services/auth.service';
import { RetroboardService } from '../../services/retroboard.service';
import { Retroboard, Bucket, Note } from '../../types';

@Component({
  selector: 'app-retro-board',
  templateUrl: './retro-board.component.html',
  styleUrls: ['./retro-board.component.scss'],
})
export class RetroBoardComponent implements OnInit, OnDestroy {
  private retroboard: Retroboard;
  private buckets: Bucket[];
  private buckets$: Observable<any[]>;
  private activeBucket: Bucket;
  private activeNote: Note;
  private activeVote: boolean;
  private jsonData: Object;
  private dialogRef: MatDialogRef<any>;
  private htmlExport: string;
  private ngUnsubscribe: Subject<any> = new Subject();
  private subscription: Subscription;
  private userDetails: firebase.User;

  constructor(
    private db: AngularFireDatabase,
    private route: ActivatedRoute,
    private authService: AuthService,
    private retroboardService: RetroboardService,
    private dialog: MatDialog,
    private router: Router,
    private exportService: ExportService,
  ) { }

  private compareFn(a, b) {
    const aVotes = a.totalVotes || -1;
    const bVotes = b.totalVotes || -1;
    if (aVotes < bVotes) {
      return 1;
    }
    if (aVotes > bVotes) {
      return -1;
    }
    return 0;
  }

  openModal(template: TemplateRef<any>, bucket: Bucket, note?: Note) {
    this.activeBucket = bucket;
    if (note) {
      this.activeNote = note;
    }
    this.dialogRef = this.dialog.open(template, {
      panelClass: 'custom-dialog-container',
    });
  }

  private getRetroboard(id: string) {
    this.subscription = this.retroboardService.getRetroboard(id)
      .subscribe(retroboard => {
        this.retroboard = retroboard;
      });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.userDetails = this.authService.getUserDetails();
    this.getRetroboard(id);

    this.buckets$ = this.db
      .list(`/buckets/${id}`)
      .snapshotChanges()
      .pipe(
        map((actions) => {
          return actions.map((a) => ({ key: a.key, ...a.payload.val() }));
        }),
        map((buckets) => {
          return buckets.map((bucket: any) => {
            bucket.notes = this.db
              .list(`/notes/${bucket.key}`)
              .snapshotChanges()
              .pipe(
                map((actions) => {
                  return actions.map((a) => ({
                    key: a.key,
                    ...a.payload.val(),
                  }));
                }),
                map((notes) => {
                  return notes.sort(this.compareFn);
                }),
              );
            return bucket;
          });
        }),
      );

    this.jsonData = {};
    this.buckets$.pipe(takeUntil(this.ngUnsubscribe)).subscribe(buckets => {
      this.buckets = buckets;
      buckets.forEach(bucket => {
        bucket.notes.pipe(takeUntil(this.ngUnsubscribe)).subscribe(notes => {
          notes.forEach(note => {
            if (!this.jsonData[bucket.key]) {
              this.jsonData[bucket.key] = {};
            }
            this.jsonData[bucket.key][note.key] = {
              type: bucket.type,
              bucketName: bucket.name,
              message: note.message,
              votes: note.totalVotes || 0,
            };
          });
        });
      });
    });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
    this.subscription.unsubscribe();
  }

  addNote(message: string) {
    this.db
      .list(`/notes/${this.activeBucket.key}`)
      .push({ message: message, votes: {} })
      .then(() => this.dialogRef.close());
  }

  updateNote(message: string) {
    this.db
      .object(`/notes/${this.activeBucket.key}/${this.activeNote.key}`)
      .update({ message: message })
      .then(() => this.dialogRef.close());
  }

  upVote(bucket?: any, note?: any) {
    if (bucket) {
      this.activeBucket = bucket;
    }
    if (note) {
      this.activeNote = note;
    }
    if (!this.activeNote.votes) {
      this.activeNote.votes = {};
    }

    if (this.activeNote.votes[this.userDetails.uid] !== true) {
      this.activeNote.votes[this.userDetails.uid] = true;
    } else {
      delete this.activeNote.votes[this.userDetails.uid];
    }

    this.activeNote.totalVotes = Object.keys(this.activeNote.votes).reduce(
      (total, vote) => (this.activeNote.votes[vote] ? total + 1 : total - 1),
      0,
    );

    this.db
      .object(`/notes/${this.activeBucket.key}/${this.activeNote.key}`)
      .update({
        votes: this.activeNote.votes,
        totalVotes: this.activeNote.totalVotes,
      })
      .then(() => (this.dialogRef ? this.dialogRef.close() : ''));
  }

  downVote(bucket: any, note?: any) {
    if (bucket) {
      this.activeBucket = bucket;
    }
    if (note) {
      this.activeNote = note;
    }
    if (!this.activeNote.votes) {
      this.activeNote.votes = {};
    }

    if (this.activeNote.votes[this.userDetails.uid] !== false) {
      this.activeNote.votes[this.userDetails.uid] = false;
    } else {
      delete this.activeNote.votes[this.userDetails.uid];
    }

    this.activeNote.totalVotes = Object.keys(this.activeNote.votes).reduce(
      (total, vote) => (this.activeNote.votes[vote] ? total + 1 : total - 1),
      0,
    );

    this.db
      .object(`/notes/${this.activeBucket.key}/${this.activeNote.key}`)
      .update({
        votes: this.activeNote.votes,
        totalVotes: this.activeNote.totalVotes,
      })
      .then(() => (this.dialogRef ? this.dialogRef.close() : ''));
  }

  deleteNote() {
    delete this.jsonData[this.activeBucket.key][this.activeNote.key];
    this.db
      .object(`/notes/${this.activeBucket.key}/${this.activeNote.key}`)
      .remove()
      .then(() => this.dialogRef.close());
  }

  hasVoted(votes, voted) {
    if (!votes) {
      return false;
    };
    if (voted) {
      return votes[this.userDetails.uid] === true;
    }
    return votes[this.userDetails.uid] === false;
  }

  deleteRetro(template: TemplateRef<any>) {
    const dialogRef = this.dialog.open(template);
    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.retroboardService.doDeleteRetro(this.buckets, this.retroboard, this.userDetails)
          .then(() => this.router.navigate(['/home']));
      }
    });
  }

  openRetroboardDetailsModal() {
    this.dialogRef = this.dialog.open(RetroboardDetailsModalComponent, {
      panelClass: 'custom-dialog-container',
      data: {
        retroboard: this.retroboard,
        buckets: this.buckets,
      }
    });
  }

  openExportModal(template: TemplateRef<any>) {
    (<any>window).gtag('event', 'export', {
      'event_category': 'retrospective',
      'event_label': 'origin'
    });
    this.htmlExport = this.exportService.export(this.jsonData);
    this.dialogRef = this.dialog.open(template, {
      panelClass: 'custom-dialog-container',
    });
  }

  copyText() {
    let range;
    if ((document as any).selection) {
      range = (document.body as any).createTextRange();
      range.moveToElementText(document.getElementById('html-container'));
      range.select();
    } else if (window.getSelection) {
      range = document.createRange();
      range.selectNode(document.getElementById('html-container'));
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
    document.execCommand('copy');
  }
}