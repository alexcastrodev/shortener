FROM ruby:4.0.7

# Install build dependencies and SQLite development libraries
RUN apt-get update -qq && apt-get install -y \
    libpq-dev \
    build-essential \
    libsqlite3-dev \
    unzip

# Install Node.js and Yarn
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install --no-install-recommends -y nodejs && \
    npm install -g yarn && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Install .NET SDK
RUN curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 10.0 --install-dir /usr/share/dotnet && \
    ln -s /usr/share/dotnet/dotnet /usr/local/bin/dotnet

RUN gem install rails bundler

# Create a non-root user "vscode"
RUN useradd -ms /bin/bash vscode

# Set the working directory and change ownership to the vscode user
WORKDIR /workspace
RUN chown -R vscode:vscode /workspace

# Switch to the non-root user
USER vscode