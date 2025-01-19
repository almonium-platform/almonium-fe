import {Component, Input, OnInit} from '@angular/core';
import {UtilsService} from '../../services/utils.service';
import {TuiSkeleton} from "@taiga-ui/kit";
import {NgStyle} from "@angular/common";
import {TuiAlertService} from "@taiga-ui/core";

@Component({
  selector: 'app-qr-code',
  templateUrl: './qr-code.component.html',
  styleUrls: ['./qr-code.component.less'],
  imports: [
    TuiSkeleton,
    NgStyle
  ]
})
export class QRCodeComponent implements OnInit {
  @Input() textToEncode: string = 'https://almonium.com';
  qrCodeUrl: string | undefined;
  skeletonImgUrl: string = 'assets/img/other/qr-skeleton.png';

  constructor(private utilsService: UtilsService,
              private alertService: TuiAlertService) {
  }

  get qrCodeImgUrl(): string | undefined {
    return this.qrCodeUrl || undefined;
  }

  ngOnInit(): void {
    if (this.textToEncode) {
      this.generateQRCode();
    }
  }

  generateQRCode(): void {
    this.utilsService.getQrCodeUrl(this.textToEncode).subscribe({
      next: (url: string) => {
        this.qrCodeUrl = url;
      },
      error: (err) => {
        console.error('Failed to generate QR code:', err);
        this.alertService.open('Failed to generate QR code', {appearance: 'error'}).subscribe();
      },
    });
  }
}
