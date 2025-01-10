import {Component, OnDestroy, OnInit} from '@angular/core';
import {CardService} from '../../services/card.service';
import {CardDto} from '../../models/card.model';
import {LanguageCode} from '../../models/language.enum';
import {Subject, takeUntil} from 'rxjs';
import {TargetLanguageDropdownService} from "../../services/target-language-dropdown.service";
import {NgOptimizedImage} from "@angular/common";
import {LanguageNameService} from "../../services/language-name.service";
import {RouterLink} from "@angular/router";

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.less'],
  imports: [
    RouterLink,
    NgOptimizedImage
  ]
})
export class ReviewComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  cards: CardDto[] = [];
  selectedLanguage!: LanguageCode;
  displayLanguageName: string = ''; // Variable to store the full name of the language

  constructor(private cardService: CardService,
              private languageService: TargetLanguageDropdownService,
              private languageNameService: LanguageNameService,
  ) {
  }

  ngOnInit(): void {
    this.languageService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((lang) => {
        this.selectedLanguage = lang;
        this.displayLanguageName = this.languageNameService.getLanguageName(lang);
        this.fetchCardsForLanguage(lang);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private fetchCardsForLanguage(language: LanguageCode): void {
    this.cardService.getCardsInLanguage(language).subscribe((cards) => {
      this.cards = cards;
    });
  }
}
