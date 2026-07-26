# Almonium Frontend

Angular browser client for Almonium. The coordinated workspace also contains:

- `../almonium-be`: Spring Boot API and browser authentication/session backend;
- `../almonium-mobile`: Expo/React Native iOS and Android client using the same
  API with Firebase ID-token bearer authentication;
- `../almonium-infra`: deployment topology and Ansible/Compose automation for
  the server-hosted FE and BE services. Mobile releases use Expo/EAS rather
  than this server deployment path.
