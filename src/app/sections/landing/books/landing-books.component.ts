import {ChangeDetectionStrategy, Component, computed, signal} from '@angular/core';
import {RouterLink} from '@angular/router';

interface ShelfBook {
  title: string;
  author: string;
  /** The plate's own ink: the cover is printed in it, and the title is set in it. */
  ink: string;
  initial?: string;
  /** A photograph printed in the ink where there is one; otherwise the title's initial on a solid plate. */
  cover?: {file: string; position: string; filter: string};
}

const PRINT = 'grayscale(1) contrast(1.2)';

/** The shelf the landing draws (Landing v3, #books). It is the designed shelf, not a query of the catalogue. */
const SHELF: ShelfBook[] = [
  {title: 'Madame Bovary', author: 'Gustave Flaubert', ink: '#5a1a74', cover: {file: 'bovary', position: '50% 45%', filter: PRINT}},
  {title: 'Die Verwandlung', initial: 'V', author: 'Franz Kafka', ink: '#2c4a52'},
  {title: 'Frankenstein', initial: 'F', author: 'Mary Shelley', ink: '#2c2530'},
  {title: 'Effi Briest', initial: 'E', author: 'Theodor Fontane', ink: '#6b4a2b'},
  {title: 'Anna Karenina', author: 'Leo Tolstoy', ink: '#7a2e2e', cover: {file: 'anna', position: '50% 15%', filter: PRINT}},
  {title: 'Don Quijote de la Mancha', author: 'Miguel de Cervantes', ink: '#3d5a3a', cover: {file: 'quix', position: '50% 40%', filter: PRINT}},
  {title: 'Pride and Prejudice', author: 'Jane Austen', ink: '#872657', cover: {file: 'pride', position: '40% 20%', filter: PRINT}},
  {title: 'Buddenbrooks', initial: 'B', author: 'Thomas Mann', ink: '#4a3d6b'},
  {title: 'Le Comte de Monte-Cristo', author: 'Alexandre Dumas', ink: '#2d4a6b', cover: {file: 'monte2', position: '50% 8%', filter: PRINT}},
  {title: 'Il fu Mattia Pascal', initial: 'F', author: 'Luigi Pirandello', ink: '#8a5a2b'},
  {title: 'Кобзар', author: 'Тарас Шевченко', ink: '#5a3a52', cover: {file: 'kobzar', position: '45% 28%', filter: 'grayscale(1) contrast(1.15) brightness(1.1)'}},
  {title: 'Die Leiden des jungen Werthers', initial: 'L', author: 'J. W. von Goethe', ink: '#3a4f5e'},
  {title: 'Niebla', initial: 'N', author: 'Miguel de Unamuno', ink: '#6b2e4a'},
  {title: 'Lazarillo de Tormes', author: 'Anonymous', ink: '#4f5a2e', cover: {file: 'lazar', position: '50% 30%', filter: 'grayscale(1) contrast(1.1) brightness(1.7)'}},
];

/**
 * "Any public-domain book, or your own": a search over the shelf and a slow roll of its covers. A hit, a miss
 * and a cover all lead to the library with the search carried over, where reading and requesting really happen.
 */
@Component({
  selector: 'app-landing-books',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink],
  templateUrl: './landing-books.component.html',
  styleUrl: './landing-books.component.less',
})
export class LandingBooksComponent {
  protected readonly shelf = SHELF;
  protected readonly query = signal('');
  protected readonly term = computed(() => this.query().trim());
  protected readonly hits = computed(() => {
    const term = this.term().toLowerCase();
    if (!term) return [];
    return SHELF.filter(book => `${book.title} ${book.author}`.toLowerCase().includes(term)).slice(0, 5);
  });

  protected coverUrl(book: ShelfBook): string | null {
    return book.cover ? `url(/assets/img/landing/covers/${book.cover.file}.jpg)` : null;
  }
}
