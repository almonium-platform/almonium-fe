import {Pipe, PipeTransform} from '@angular/core';
import {formatDistanceToNow} from 'date-fns';

@Pipe({
  name: 'relativeTime',
  pure: false // Ensures real-time updates
})
export class RelativeTimePipe implements PipeTransform {
  transform(value: Date | string): string {
    if (!value) return '';

    const timeAgo = formatDistanceToNow(new Date(value));

    if (timeAgo.includes('less than a minute')) {
      return 'just now';
    }

    return timeAgo.replace(/\babout\b/gi, '') + ' ago';
  }
}
