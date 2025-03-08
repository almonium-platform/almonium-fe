import {Pipe, PipeTransform} from '@angular/core';
import {formatDistanceToNow} from 'date-fns';

@Pipe({
  name: 'shortRelativeTime'
})
export class ShortRelativeTimePipe implements PipeTransform {
  transform(value: Date | string): string {
    if (!value) return '';

    const timeAgo = formatDistanceToNow(new Date(value), {addSuffix: true});

    if (timeAgo.includes('less than a minute')) {
      return 'just now';
    }

    return timeAgo
      .replace(/\bmonths\b/gi, 'mon')
      .replace(/\bmonth\b/gi, 'mon')
      .replace(/\bhours\b/gi, 'hrs')
      .replace(/\bhour\b/gi, 'hr')
      .replace(/\bminutes\b/gi, 'min')
      .replace(/\bminute\b/gi, 'min')
      .replace(/\bseconds\b/gi, 'sec')
      .replace(/\bsecond\b/gi, 'sec')
      .replace(/\babout\b/gi, '');
  }
}
