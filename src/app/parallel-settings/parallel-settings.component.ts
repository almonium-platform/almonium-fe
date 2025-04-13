import {Component, TemplateRef, ViewChild} from '@angular/core';
import {TuiSegmented} from "@taiga-ui/kit";

interface ModeConfig {
  imageSrc: string;
  altText: string;
  explanation: string;
}

@Component({
  selector: 'app-parallel-settings',
  imports: [
    TuiSegmented
  ],
  templateUrl: './parallel-settings.component.html',
  styleUrl: './parallel-settings.component.less'
})
export class ParallelSettingsComponent {
  @ViewChild('parallelSettings', {static: true}) content!: TemplateRef<any>;

  modeSelectedIndex: number = 0;

  // --- Define the configuration for each mode ---
  readonly modeConfigs: ModeConfig[] = [
    { // Index 0: Side By Side
      imageSrc: 'assets/img/icons/side.svg', // Replace with actual path
      altText: 'Side by Side View',
      explanation: 'Displays the original text and its translation in separate columns, side-by-side. Be careful not to only read the version you understand.'
    },
    { // Index 1: Overlay
      imageSrc: 'assets/img/icons/overlay.svg', // Replace with actual path
      altText: 'Overlay View',
      explanation: 'Shows the original text. Click on a sentence or segment to reveal its translation in a popup or overlay.'
    },
    { // Index 2: Inline
      imageSrc: 'assets/img/icons/inline.svg', // Replace with actual path
      altText: 'Inline View',
      explanation: 'Interleaves the original text and its translation segment by segment, one after the other.'
    }
  ];

  // --- Getter to easily access the config for the selected mode ---
  get currentModeConfig(): ModeConfig {
    // Provide a default or handle out-of-bounds index if necessary
    return this.modeConfigs[this.modeSelectedIndex] ?? this.modeConfigs[0];
  }

  onModeIndexChange(newIndex: number): void {
    console.log('Selected index:', newIndex);
    // The [(activeItemIndex)] binding handles updating modeSelectedIndex automatically
    // You can add other logic here if needed when the mode changes
  }
}
