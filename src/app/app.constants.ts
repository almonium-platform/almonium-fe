import { environment } from '../environments/environment';

export class AppConstants {
  private static API_BASE_URL = environment.apiUrl;
  public static API_URL = AppConstants.API_BASE_URL + '/api/v1';

  public static AUTH_API = AppConstants.API_URL + '/auth';

  private static OAUTH2_URL = AppConstants.API_URL + '/oauth2/authorization';
  private static REDIRECT_URL = '?redirect_uri=' + environment.feUrl + '/home';

  public static GOOGLE_AUTH_URL = AppConstants.OAUTH2_URL + '/google' + AppConstants.REDIRECT_URL;
  public static FACEBOOK_AUTH_URL = AppConstants.OAUTH2_URL + '/facebook' + AppConstants.REDIRECT_URL;
  public static APPLE_AUTH_URL = AppConstants.OAUTH2_URL + '/apple' + AppConstants.REDIRECT_URL;
}
