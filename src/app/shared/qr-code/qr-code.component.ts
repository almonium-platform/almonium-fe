import {Component, Input, OnInit} from '@angular/core';
import {UtilsService} from "../../services/utils.service";
import {NgStyle} from "@angular/common";

@Component({
  selector: 'app-qr-code',
  templateUrl: './qr-code.component.html',
  imports: [
    NgStyle
  ],
  styleUrls: ['./qr-code.component.less']
})
export class QRCodeComponent implements OnInit {
  @Input() textToEncode: string = 'https://almonium.com/users/1234';
  qrCodeUrl: string | undefined;

  constructor(private utilsService: UtilsService) {
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
        console.log('QR Code URL:', this.qrCodeUrl); // Debug
      },
      error: (err) => console.error('Failed to generate QR code:', err)
    });
  }
}
