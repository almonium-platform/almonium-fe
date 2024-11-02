import {environment} from '../environments/environment';

export class AppConstants {
  // URLS

  public static API_URL = environment.apiUrl + '/api/v1';
  public static PUBLIC_URL = AppConstants.API_URL + '/public';
  public static USERS_URL = AppConstants.API_URL + '/users';

  // AUTHENTICATION
  public static PUBLIC_AUTH_URL = AppConstants.PUBLIC_URL + '/auth';
  public static VERIFICATION_AUTH_URL = AppConstants.PUBLIC_AUTH_URL + '/verification';
  public static AUTH_URL = AppConstants.API_URL + '/auth';
  public static EMAIL_CHANGE_REQUEST_URL = AppConstants.AUTH_URL + '/email/change-request';
  public static EMAIL_VERIFICATION_URL = AppConstants.AUTH_URL + '/verification/email';

  private static OAUTH2_URL = AppConstants.API_URL + '/oauth2/authorization';
  private static REDIRECT_URL = '?redirect_uri=' + environment.feUrl;

  public static GOOGLE_AUTH_URL_WITH_REDIRECT_TO = AppConstants.OAUTH2_URL + '/google' + AppConstants.REDIRECT_URL;
  public static APPLE_AUTH_URL_WITH_REDIRECT_TO = AppConstants.OAUTH2_URL + '/apple' + AppConstants.REDIRECT_URL;
  public static GOOGLE_ONE_TAP_VERIFY_URL = AppConstants.PUBLIC_AUTH_URL + '/google/one-tap';

  // Cards
  public static CARDS_URL = AppConstants.API_URL + '/cards';
  public static CARDS_IN_LANG = AppConstants.CARDS_URL + '/lang';


  // OTHER
  public static MIN_PASSWORD_LENGTH = 8;
}
