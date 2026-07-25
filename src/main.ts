import {logger} from "./app/shared/logger";
import {bootstrapApplication} from '@angular/platform-browser';
import {AppComponent} from './app/app.component';
import {appConfig} from "./app/app.config";

bootstrapApplication(AppComponent, appConfig).catch((err) => logger.error(err));
