import {Component, OnDestroy, OnInit} from '@angular/core';
import {CardService} from '../../services/card.service';
import {CardDto} from '../../models/card.model';
import {LanguageCode} from '../../models/language.enum';
import {Subscription} from 'rxjs';
import {TargetLanguageDropdownService} from "../../services/target-language-dropdown.service";
import {NgIf, NgOptimizedImage} from "@angular/common";
import {LanguageNameService} from "../../services/language-name.service";
import {RouterLink} from "@angular/router";
import {NavbarWrapperComponent} from "../../shared/navbars/navbar-wrapper/navbar-wrapper.component";

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.less'],
  imports: [
    NgIf,
    RouterLink,
    NgOptimizedImage,
    NavbarWrapperComponent
  ],
  standalone: true
})
export class ReviewComponent implements OnInit, OnDestroy {
  cards: CardDto[] = [];
  selectedLanguage!: LanguageCode;
  private languageSubscription: Subscription | null = null;
  displayLanguageName: string = ''; // Variable to store the full name of the language

  constructor(private cardService: CardService,
              private languageService: TargetLanguageDropdownService,
              private languageNameService: LanguageNameService,
  ) {
  }

  ngOnInit(): void {
    this.languageSubscription = this.languageService.currentLanguage$.subscribe((lang) => {
      this.selectedLanguage = lang;
      this.displayLanguageName = this.languageNameService.getLanguageName(lang);
      this.fetchCardsForLanguage(lang);
    });
  }

  ngOnDestroy(): void {
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
  }

  private fetchCardsForLanguage(language: LanguageCode): void {
    this.cardService.getCardsInLanguage(language).subscribe((cards) => {
      this.cards = cards;
    });
  }

  protected readonly length = length;
}
