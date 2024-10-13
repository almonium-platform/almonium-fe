import {Component, OnDestroy, OnInit} from '@angular/core';
import {CardService} from '../../services/card.service';
import {CardDto} from '../../models/card.model';
import {Language} from '../../models/language.enum';
import {Subscription} from 'rxjs';
import {LanguageService} from "../../services/language.service";
import {NavbarComponent} from "../../shared/navbar/navbar.component";
import {NgIf, NgOptimizedImage} from "@angular/common";
import {LanguageNameService} from "../../services/language-name.service";
import {RouterLink} from "@angular/router";

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  styleUrls: ['./training.component.less'],
  imports: [
    NavbarComponent,
    NgIf,
    RouterLink,
    NgOptimizedImage
  ],
  standalone: true
})
export class TrainingComponent implements OnInit, OnDestroy {
  cards: CardDto[] = [];
  selectedLanguage!: Language;
  private languageSubscription: Subscription | null = null;
  displayLanguageName: string = ''; // Variable to store the full name of the language

  constructor(private cardService: CardService,
              private languageService: LanguageService,
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

  private fetchCardsForLanguage(language: Language): void {
    this.cardService.getCardsInLanguage(language).subscribe((cards) => {
      console.log('Fetched cards:', cards);
      this.cards = cards;
    });
  }

  protected readonly length = length;
}
