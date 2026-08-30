import {environment} from '../environments/environment';

export class AppConstants {

  // BASE URLS
  public static API_URL = environment.apiUrl + '/api/v1';
  public static PUBLIC_URL = AppConstants.API_URL + '/public';
  public static USERS_URL = AppConstants.API_URL + '/users';
  public static INFO_URL = AppConstants.PUBLIC_URL + '/info';

  // AUTHENTICATION
  public static PUBLIC_AUTH_URL = AppConstants.PUBLIC_URL + '/auth';
  public static AUTH_URL = AppConstants.API_URL + '/auth';

  // CARDS
  public static CARDS_URL = AppConstants.API_URL + '/cards';
  public static CARDS_IN_LANG = AppConstants.CARDS_URL + '/lang';
  public static REVIEW_URL = AppConstants.API_URL + '/review';

  // LEARNING RHYTHM
  public static LEARNING_URL = AppConstants.API_URL + '/learning';

  // PROFILE TODO cleanup
  public static AVATARS_URL = AppConstants.API_URL + '/profiles/me/avatars';
  public static ME_URL = AppConstants.USERS_URL + '/me';
  public static PROFILE_URL = AppConstants.API_URL + '/profile';
  public static PUBLIC_PROFILE_URL = AppConstants.PUBLIC_URL + '/profiles';

  // BOOKS
  public static PUBLIC_BOOKS_URL = AppConstants.PUBLIC_URL + '/books';
  public static BOOKS_URL = AppConstants.API_URL + '/books';
  public static BOOK_IMPORTS_URL = AppConstants.API_URL + '/book-imports';

  // PLANS
  public static PLAN_URL = AppConstants.PUBLIC_URL + '/plans';
  public static SUBSCRIPTION_URL = AppConstants.API_URL + '/subscriptions';

  // LANGUAGES
  public static MY_LANGUAGES_URL = AppConstants.ME_URL + '/langs';

  // LEARNER PROFILES
  public static LEARNER_PROFILES_URL = AppConstants.API_URL + '/learners';

  // ONBOARDING
  public static ONBOARDING_URL = AppConstants.API_URL + '/onboarding';
  public static ONBOARDING_STEP_URL = AppConstants.ONBOARDING_URL + '/step';

  // SOCIAL
  public static RELATIONSHIPS_URL = AppConstants.API_URL + '/relationships';
  public static NOTIFICATIONS_URL = AppConstants.API_URL + '/notifications';

  // UTILS
  public static UTILS_URL = AppConstants.API_URL + '/utils';

  // OPS (admin-only)
  public static OPS_URL = AppConstants.API_URL + '/ops';

  // OTHER
  public static MIN_PASSWORD_LENGTH = 8;

  public static MIN_USERNAME_LENGTH = 3;
  public static MAX_USERNAME_LENGTH = 20;
  public static USERNAME_PATTERN = '^[a-zA-Z0-9_]*$';

  // CHATS
  public static PRIVATE_CHAT_NAME = 'Private Chat';
  public static SELF_CHAT_NAME = 'Saved Messages';
  public static DEFAULT_CHANNEL_NAME = 'Almonium';
}
