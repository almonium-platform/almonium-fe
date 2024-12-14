import {environment} from '../environments/environment';

export class AppConstants {

  // BASE URLS
  public static API_URL = environment.apiUrl + '/api/v1';
  public static PUBLIC_URL = AppConstants.API_URL + '/public';
  public static USERS_URL = AppConstants.API_URL + '/users';

  // AUTHENTICATION
  public static PUBLIC_AUTH_URL = AppConstants.PUBLIC_URL + '/auth';
  public static VERIFICATION_AUTH_URL = AppConstants.PUBLIC_AUTH_URL + '/verification';
  public static AUTH_URL = AppConstants.API_URL + '/auth';
  public static EMAIL_VERIFICATION_URL = AppConstants.AUTH_URL + '/verification/email/requests';

  private static OAUTH2_URL = AppConstants.API_URL + '/oauth2/authorization';
  private static REDIRECT_URL = '?redirect_uri=' + environment.feUrl;

  public static GOOGLE_AUTH_URL_WITH_REDIRECT_TO = AppConstants.OAUTH2_URL + '/google' + AppConstants.REDIRECT_URL;
  public static APPLE_AUTH_URL_WITH_REDIRECT_TO = AppConstants.OAUTH2_URL + '/apple' + AppConstants.REDIRECT_URL;
  public static GOOGLE_ONE_TAP_VERIFY_URL = AppConstants.PUBLIC_AUTH_URL + '/google/one-tap';

  // CARDS
  public static CARDS_URL = AppConstants.API_URL + '/cards';
  public static CARDS_IN_LANG = AppConstants.CARDS_URL + '/lang';

  // LANGUAGES
  public static MY_LANGUAGES_URL = AppConstants.USERS_URL + '/me/langs';

  // PROFILE
  public static AVATARS_URL = AppConstants.API_URL + '/profiles/me/avatars';

  // PLANS
  public static PLAN_URL = AppConstants.PUBLIC_URL + '/plans';
  public static SUBSCRIPTION_URL = AppConstants.API_URL + '/subscriptions';

  // OTHER
  public static MIN_PASSWORD_LENGTH = 8;
}
