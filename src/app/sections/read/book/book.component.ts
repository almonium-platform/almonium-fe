import {Component, OnDestroy, OnInit} from "@angular/core";
import {Subject, takeUntil} from "rxjs";
import {ActivatedRoute} from "@angular/router";
import {TuiAlertService} from "@taiga-ui/core";

@Component({
  selector: 'app-book',
  imports: [],
  templateUrl: './book.component.html',
  styleUrl: './book.component.less'
})
export class BookComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  bookId: number | null = null;

  constructor(private activatedRoute: ActivatedRoute,
              private alertService: TuiAlertService) {

  }

  ngOnInit() {
    // Extract the 'id' parameter from the route (Path variable)
    this.activatedRoute.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const id = params.get('id');
        if (id) {
          this.bookId = +id; // Only set if id is not null
        } else {
          this.bookId = null; // Handle the case where the id is not found
        }
        console.log('Book ID:', this.bookId); // Use the ID as needed
        // You can now fetch book data based on this ID
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
