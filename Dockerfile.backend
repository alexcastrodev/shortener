FROM ruby:3.4.7

RUN apt-get update -qq && apt-get install -y \
    libpq-dev \
    libjemalloc2 \
    build-essential \
    unzip

RUN gem install rails bundler

WORKDIR /rails

COPY backend/Gemfile backend/Gemfile.lock ./

RUN bundle install

# Copy application code
COPY backend/ .

RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    chown -R rails:rails db log storage tmp

USER 1000:1000

ENTRYPOINT ["/rails/bin/docker-entrypoint"]

EXPOSE 80
EXPOSE 3000

CMD ["./bin/thrust", "./bin/rails", "server", "-b", "0.0.0.0"]
