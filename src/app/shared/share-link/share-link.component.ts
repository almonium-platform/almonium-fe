import {logger} from "../logger";
import {Component, Input, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {QRCodeComponent} from '../qr-code/qr-code.component';
import {TuiIcon} from '@taiga-ui/core/components';

@Component({
  selector: 'app-share-link',
  templateUrl: './share-link.component.html',
  imports: [QRCodeComponent, TuiIcon],
  styleUrls: ['./share-link.component.less'],
})
export class ShareLinkComponent implements OnInit {
  @ViewChild('shareLink', {static: true}) content!: TemplateRef<unknown>;
  @Input() link!: string;
  @Input() title!: string;
  protected showCopied = false;
  protected fieldTextValue = '';

  ngOnInit(): void {
    this.fieldTextValue = this.link;
  }

  protected copy(): void {
    navigator.clipboard.writeText(this.link).then(
      () => {
        this.fieldTextValue = 'Copied!';
        this.showCopied = true;
        setTimeout(() => {
          this.fieldTextValue = this.link;
          this.showCopied = false;
        }, 1000);
      },
      (err) => {
        logger.error('Failed to copy: ', err);
      }
    );
  }

  get fieldText(): string {
    return this.fieldTextValue;
  }
}
