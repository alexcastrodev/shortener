FROM debian:bookworm-slim
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y -qq curl jq python3 postgresql-client ca-certificates && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives
WORKDIR /security
