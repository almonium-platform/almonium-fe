import {Pipe, PipeTransform} from '@angular/core';
import {formatDistanceToNow} from 'date-fns';

@Pipe({
  name: 'shortRelativeTime'
})
export class ShortRelativeTimePipe implements PipeTransform {
  transform(value: Date | string): string {
    if (!value) return '';

    const timeAgo = formatDistanceToNow(new Date(value), {addSuffix: true});
    return timeAgo
      .replace('about ', '')
      .replace('months', 'mon')
      .replace('hours', 'hrs')
      .replace('minute', 'min')
      .replace('minutes', 'min')
      .replace('seconds', 'sec');
  }
}
