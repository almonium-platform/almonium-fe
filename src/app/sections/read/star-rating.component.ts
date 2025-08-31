import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="star-rating">
      @for (i of getRange(5); track i; let index = $index) {
        <div class="star-container">
          <div class="star-background"></div>
          <div
            class="star-foreground"
            [style.width.%]="getStarFillPercentage(index)"
          ></div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./star-rating.component.less'], // Keep the LESS from the previous working version
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarRatingComponent {
  _rating: number = 0;
  @Input()
  set rating(value: number) {
    this._rating = Math.max(0, Math.min(5, value || 0));
  }
  get rating(): number {
    return this._rating;
  }

  getRange(count: number): number[] {
    return Array.from({ length: count }, (_, i) => i);
  }

  /**
   * Calculates the fill percentage (0-100) for a specific star's foreground,
   * using a non-linear mapping centered around 0.5 for a more
   * "perceptually weighted" or "area-like" visual effect.
   * @param starIndex The 0-based index of the star.
   * @returns Fill percentage (0-100) for that star's foreground width.
   */
  getStarFillPercentage(starIndex: number): number {
    // Fraction of rating applicable to this star (value between 0 and 1)
    const ratingFraction = this.rating - starIndex;

    // Handle full or empty stars directly
    if (ratingFraction >= 1) {
      return 100;
    }
    if (ratingFraction <= 0) {
      return 0;
    }

    // --- Non-Linear Mapping - Centered around 0.5 ---

    // Tunable factor: Lower value = more curve/distortion near 0 and 1
    // A value of 1.0 would be perfectly linear.
    // Values < 1 curve "outward" (boost low values, compress high values)
    // Values > 1 curve "inward" (compress low values, boost high values - not what we want here)
    const distortionFactor = 0.35; // Experiment with values like 0.3, 0.4, 0.5

    let visualPercentage: number;

    if (ratingFraction === 0.5) {
      // Exactly 0.5 maps to 50%
      visualPercentage = 50;
    } else if (ratingFraction < 0.5) {
      // Input range [0, 0.5) -> Output range [0, 50)
      // 1. Normalize the input to [0, 1) based on its distance from 0 within this half
      const normalizedInput = ratingFraction / 0.5;
      // 2. Apply the power function
      const warpedValue = Math.pow(normalizedInput, distortionFactor);
      // 3. Scale the result to the [0, 50) range
      visualPercentage = warpedValue * 50;
    } else { // ratingFraction > 0.5
      // Input range (0.5, 1] -> Output range (50, 100]
      // 1. Normalize the input based on its distance from 1 within this half (result is 0 to 1)
      const normalizedDistanceFromOne = (1 - ratingFraction) / 0.5;
      // 2. Apply the power function (gives the "amount to subtract from 100%", scaled 0-1)
      const warpedDistanceFromOne = Math.pow(normalizedDistanceFromOne, distortionFactor);
      // 3. Scale the subtraction amount to the [0, 50) range and subtract from 100
      visualPercentage = 100 - (warpedDistanceFromOne * 50);
    }

    // Safety clamp
    return Math.max(0, Math.min(100, visualPercentage));
  }
}
