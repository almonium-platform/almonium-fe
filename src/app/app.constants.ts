import {environment} from '../environments/environment';

export class AppConstants {
  public static API_URL = environment.apiUrl + '/api/v1';
  public static PUBLIC_URL = AppConstants.API_URL + '/public';

  public static PUBLIC_AUTH_URL = AppConstants.PUBLIC_URL + '/auth';
  public static AUTH_URL = AppConstants.API_URL + '/auth';

  private static OAUTH2_URL = AppConstants.API_URL + '/oauth2/authorization';
  private static REDIRECT_URL = '?redirect_uri=' + environment.feUrl + '/home';

  public static GOOGLE_AUTH_URL = AppConstants.OAUTH2_URL + '/google' + AppConstants.REDIRECT_URL;
  public static FACEBOOK_AUTH_URL = AppConstants.OAUTH2_URL + '/facebook' + AppConstants.REDIRECT_URL;
  public static APPLE_AUTH_URL = AppConstants.OAUTH2_URL + '/apple' + AppConstants.REDIRECT_URL;
  public static GOOGLE_ONE_TAP_VERIFY_URL = AppConstants.PUBLIC_AUTH_URL + '/google/one-tap';
}
