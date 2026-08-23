import {logger} from "../logger";
import {TuiNotificationService} from "@taiga-ui/core/components";
import { Component, Input, OnInit, inject } from '@angular/core';
import {UtilsService} from '../../services/utils.service';
import {TuiSkeleton} from "@taiga-ui/kit/directives";
import {NgStyle} from "@angular/common";
import {Router} from "@angular/router";
import {PopupTemplateStateService} from "../modals/popup-template/popup-template-state.service";

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
  private utilsService = inject(UtilsService);
  private alertService = inject(TuiNotificationService);
  private router = inject(Router);
  private popupTemplateStateService = inject(PopupTemplateStateService);

  @Input() linkToEncode = 'https://almonium.com';
  qrCodeUrl: string | undefined;
  skeletonImgUrl = 'assets/img/other/qr-skeleton.png';

  ngOnInit(): void {
    if (this.linkToEncode) {
      this.generateQRCode();
    }
  }

  get qrCodeImgUrl(): string | undefined {
    return this.qrCodeUrl ?? undefined;
  }


  private generateQRCode(): void {
    this.utilsService.getQrCodeUrl(this.linkToEncode).subscribe({
      next: (url: string) => {
        this.qrCodeUrl = url;
      },
      error: (err) => {
        logger.error('Failed to generate QR code:', err);
        this.alertService.open('Failed to generate QR code', {appearance: 'negative'}).subscribe();
      },
    });
  }

  protected redirect(): void {
    const target = new URL(this.linkToEncode, window.location.origin);

    this.popupTemplateStateService.closeImmediately();
    setTimeout(() => {
      if (target.origin === window.location.origin) {
        void this.router.navigateByUrl(`${target.pathname}${target.search}${target.hash}`);
        return;
      }

      window.location.assign(target.href);
    }, 0);
  }
}
