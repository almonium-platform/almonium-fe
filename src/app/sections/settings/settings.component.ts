import {Component} from '@angular/core';
import {NavbarComponent} from "../../shared/navbars/navbar/navbar.component";
import {NgIf, NgOptimizedImage} from "@angular/common";
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";
import {ConfirmModalComponent} from "../../shared/modals/confirm-modal/confirm-modal.component";
import {SettingService} from "./settings.service";
import {TuiAlertService} from "@taiga-ui/core";
import {Router} from "@angular/router";
import {UserInfoService} from "../../services/user-info.service";

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    NavbarComponent,
    NgOptimizedImage,
    NotReadyComponent,
    NgIf,
    ConfirmModalComponent
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.less']
})
export class SettingsComponent {
  constructor(
    private settingService: SettingService,
    private alertService: TuiAlertService,
    private userInfoService: UserInfoService,
    private router: Router,
  ) {
  }

  isModalVisible = false;

  // Function to show the modal
  showDeleteAccountPopup() {
    this.isModalVisible = true;
  }

  // Function to close the modal
  closeModal() {
    this.isModalVisible = false;
  }

  confirmDeletion() {
    console.log('Account deletion confirmed.');
    this.closeModal();

    this.settingService.deleteAccount().subscribe({
      next: () => {  // No response body expected for 204
        this.alertService.open('Account successfully deleted!', {status: 'success'}).subscribe();
        this.userInfoService.clearUserInfo();
        this.router.navigate(['/']).then(() => {
          console.log('Redirected to auth');
        });
        this.closeModal();
      },
      error: (error) => {
        this.alertService
          .open(error.error.message || 'Failed to delete account', {status: 'error'})
          .subscribe();
        this.closeModal();
      },
    });
  }
}
