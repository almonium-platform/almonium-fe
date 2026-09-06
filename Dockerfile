# Serves an already built bundle. Build it first:
#   npm run build -- --configuration <staging|production>
# CI builds once natively, then copies the result in here, so the image build
# is a file copy on any runner and never emulates the target CPU.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/almonium-fe/browser/ /usr/share/nginx/html/
