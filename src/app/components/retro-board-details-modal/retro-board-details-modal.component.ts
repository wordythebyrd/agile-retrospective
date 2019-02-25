import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { RetroboardService } from '../../services/retroboard.service';
import { Router } from '@angular/router';

const DEFAULT_BUCKETS = [
  { name: 'What went well?' },
  { name: 'What can be improved?' },
  { name: 'Action items' }
];

@Component({
  selector: 'app-retro-board-details-modal',
  templateUrl: './retro-board-details-modal.component.html',
  styleUrls: ['./retro-board-details-modal.component.scss']
})
export class RetroboardDetailsModalComponent implements OnInit {

  isUpdate: boolean;
  retroboardName = '';
  buckets: { name: string, key?: string }[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<RetroboardDetailsModalComponent>,
    private retroboardService: RetroboardService,
    private router: Router,
  ) { }

  ngOnInit() {
    if (this.data) {
      this.isUpdate = true;
      this.retroboardName = this.data.retroboard.name;
      this.buckets = this.data.buckets;
    } else {
      this.buckets = DEFAULT_BUCKETS;
    }
  }

  createRetroboard() {
    this.retroboardService.createRetroboard(this.retroboardName, this.buckets.map(b => b.name))
      .then((id) => {
        this.dialogRef.close();
        this.router.navigate(['/retroboard/', id]);
      });
  }

  updateRetroboard() {
    this.retroboardService.updateRetroboard(this.data.retroboard.key, {
      name: this.retroboardName,
      buckets: this.buckets,
    })
      .then(() => {
        this.dialogRef.close();
      });
  }

  closeDialog() {
    this.dialogRef.close();
  }

}
