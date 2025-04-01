import {Component, OnInit} from '@angular/core';
import {ReadService} from '../read.service';
import {CommonModule} from "@angular/common";
import {TuiAlertService} from "@taiga-ui/core";

@Component({
  selector: 'app-reader',
  imports: [CommonModule],
  templateUrl: './reader.component.html',
  styleUrls: ['./reader.component.less']
})
export class ReaderComponent implements OnInit {
  protected text: string = '';

  constructor(private readService: ReadService,
              private alertService: TuiAlertService,
  ) {
  }

  ngOnInit(): void {
    const bookId = 1; // Replace with the actual book ID you want to load

    this.readService.loadBook(bookId).subscribe({
      next: (response) => {
        if (response.status === 200 && response.body) {
          const decodedText = this.arrayBufferToString(response.body);
          this.text = this.transformMarkdown(decodedText);
        } else {
          console.error('Unexpected response:', response.status);
          this.alertService.open('Failed to load a book', {appearance: 'error'}).subscribe();
        }
      },
      error: (error) => {
        this.alertService.open(error.error.message || 'Failed to load a book', {appearance: 'error'}).subscribe();
      }
    });
  }

  private transformMarkdown(text: string): string {
    // The 's' flag makes . match newlines
    return text
      .replace(/_(.*?)_/gs, '<em>$1</em>')
      .replace(/—/g, ' — ')
      .replace(/”/g, '"')
      .replace(/“/g, '"');
  }

  private arrayBufferToString(buffer: ArrayBuffer): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
}
