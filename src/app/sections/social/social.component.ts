import {Component, OnDestroy, OnInit, signal} from "@angular/core";
import {SocialService} from "./social.service";
import {TuiInputModule, TuiTextfieldControllerModule} from "@taiga-ui/legacy";
import {FormControl, ReactiveFormsModule} from "@angular/forms";
import {Subject, takeUntil} from "rxjs";
import {catchError, debounceTime, distinctUntilChanged, switchMap} from "rxjs/operators";
import {Friend, FriendshipAction, RelatedUserPublicProfile, UserPublicProfile} from "./social.model";
import {AvatarComponent} from "../../shared/avatar/avatar.component";
import {TuiAlertService, TuiPopup, TuiScrollbar} from "@taiga-ui/core";
import {NgClass, NgTemplateOutlet} from "@angular/common";
import {TuiDrawer, TuiSegmented, TuiSkeleton} from "@taiga-ui/kit";
import {SharedLucideIconsModule} from "../../shared/shared-lucide-icons.module";
import {DismissButtonComponent} from "../../shared/modals/elements/dismiss-button/dismiss-button.component";
import {ActivatedRoute} from "@angular/router";
import {UrlService} from "../../services/url.service";


@Component({
  selector: 'app-social',
  templateUrl: './social.component.html',
  styleUrls: ['./social.component.less'],
  imports: [
    TuiInputModule,
    ReactiveFormsModule,
    TuiTextfieldControllerModule,
    AvatarComponent,
    SharedLucideIconsModule,
    NgClass,
    TuiSegmented,
    TuiPopup,
    TuiDrawer,
    DismissButtonComponent,
    TuiScrollbar,
    TuiSkeleton,
    NgTemplateOutlet,
  ]
})
export class SocialComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  protected usernameFormControl = new FormControl<string>('');
  protected friendFormControl = new FormControl<string>('');
  protected nothingFound = false;
  protected matchedUsers: UserPublicProfile[] = [];
  protected matchedFriends: Friend[] = [];
  protected requestedIds: number[] = [];
  protected outgoingRequests: RelatedUserPublicProfile[] = [];
  protected incomingRequests: RelatedUserPublicProfile[] = [];
  protected friends: Friend[] = [];
  protected filteredFriends: Friend[] = [];
  protected requestsIndex: number = 0;

  protected readonly open = signal(false);
  protected loadingIncomingRequests: boolean = false;
  protected loadingOutgoingRequests: boolean = false;

  isNotFiltered() {
    return this.friendFormControl.value?.trim() === '';
  }

  protected openRequestsTab() {
    this.open.set(true);
    this.getOutgoingRequests();
    this.getIncomingRequests();
  }

  public onClose(): void {
    this.open.set(false);
  }

  constructor(
    private socialService: SocialService,
    private alertService: TuiAlertService,
    private urlService: UrlService,
    private activatedRoute: ActivatedRoute,
  ) {
  }

  protected openMenu() {
    this.openRequestsTab();
  }

  protected openChat(friendshipId: number) {
    console.log('Open chat');
  }

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['requests'] === 'received') {
        this.requestsIndex = 0;
        this.openRequestsTab();
      }
      if (params['requests'] === 'sent') {
        this.requestsIndex = 1;
        this.openRequestsTab();
      }
      this.urlService.clearUrl();
    });

    this.getFriends();
    this.listenToUsernameField();
    this.listenToFriendUsernameField();
  }

  private listenToUsernameField() {
    this.usernameFormControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap((username) => {
          if ((username?.length ?? 0) < 3) {
            // Clear the results and reset the "nothing found" flag
            this.matchedUsers = [];
            this.nothingFound = false;
            return []; // Emit an empty array
          }
          return this.socialService.searchAllByUsername(username || '').pipe(
            catchError(() => {
              this.nothingFound = true; // Handle errors
              return []; // Return an empty array in case of errors
            })
          );
        })
      )
      .subscribe((friends: UserPublicProfile[]) => {
        this.matchedUsers = friends;
        this.nothingFound = friends.length === 0;
      });
  }

  private listenToFriendUsernameField() {
    this.friendFormControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
        switchMap((username) => {
          const filteredFriends = this.friends.filter(friend =>
            friend.username.toLowerCase().includes((username ?? '').toLowerCase())
          );

          this.filteredFriends = filteredFriends;
          this.nothingFound = filteredFriends.length === 0;

          return [];
        })
      )
      .subscribe();
  }

  range(n: number): number[] {
    return Array.from({length: n}, (_, i) => i);
  }

  getOutgoingRequests() {
    this.loadingOutgoingRequests = true;
    this.socialService.getOutgoingRequests().subscribe(outgoingRequests => {
      this.outgoingRequests = outgoingRequests;
      this.loadingOutgoingRequests = false;
    });
  }

  getIncomingRequests() {
    this.loadingIncomingRequests = true;
    this.socialService.getIncomingRequests().subscribe(incomingRequests => {
      this.incomingRequests = incomingRequests;
      this.loadingIncomingRequests = false;
    });
  }

  getFriends() {
    this.socialService.fetchFriends().subscribe(friends => {
      this.friends = friends;
      this.filteredFriends = friends;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  searchNewUsers() {
    this.socialService.searchAllByUsername(this.usernameFormControl.value ?? '').subscribe(friends => {
      console.log(friends);
    });
  }

  cancelFriendRequest(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.CANCEL).subscribe({
      next: () => {
        this.outgoingRequests = this.outgoingRequests.filter(request => request.friendshipId !== id);
        this.alertService.open('Friend request cancelled', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to cancel friendship request', {appearance: 'error'}).subscribe();
      }
    });
  }

  acceptFriendRequest(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.ACCEPT).subscribe({
      next: () => {
        this.getFriends();
        this.incomingRequests = this.incomingRequests.filter(request => request.friendshipId !== id);
        this.alertService.open('Friend request accepted', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to accept friendship request', {appearance: 'error'}).subscribe();
      }
    });
  }

  rejectFriendRequest(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.REJECT).subscribe({
      next: () => {
        console.log(JSON.stringify(this.incomingRequests));
        this.incomingRequests = this.incomingRequests.filter(request => request.friendshipId !== id);
        console.log(JSON.stringify(this.incomingRequests));
        this.alertService.open('Friend request rejected', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to reject friendship request', {appearance: 'error'}).subscribe();
      }
    });
  }

  unfriend(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.UNFRIEND).subscribe({
      next: () => {
        this.alertService.open('Friend removed', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to remove friend', {appearance: 'error'}).subscribe();
      }
    });
  }

  block(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.BLOCK).subscribe({
      next: () => {
        this.alertService.open('User blocked', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to block user', {appearance: 'error'}).subscribe();
      }
    });
  }

  unblock(id: number) {
    this.socialService.patchFriendship(id, FriendshipAction.UNBLOCK).subscribe({
      next: () => {
        this.alertService.open('User unblocked', {appearance: 'success'}).subscribe();
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to unblock user', {appearance: 'error'}).subscribe();
      }
    });
  }

  sendFriendRequest(id: number) {
    this.socialService.createFriendshipRequest(id).subscribe({
      next: (friendship) => {
        console.log(friendship);
        this.alertService.open('We notified user about your request', {appearance: 'success'}).subscribe();
        this.requestedIds.push(id);
        setTimeout(() => {
          this.getOutgoingRequests();
          this.matchedUsers = this.matchedUsers.filter(user => user.id !== id);
          this.requestedIds = this.requestedIds.filter(requestedId => requestedId !== id);
        }, 2000);
      },
      error: (error) => {
        console.error(error);
        this.alertService.open(error.error.message || 'Failed to send friendship request', {appearance: 'error'}).subscribe();
      }
    });
  }
}
