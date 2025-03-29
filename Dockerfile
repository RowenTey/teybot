# Build the application from source
FROM golang:1.23-alpine AS build-stage

WORKDIR /app

COPY go.* ./
RUN go mod download

COPY . .
RUN go get -d -v && \
    GOOS=linux GOARCH=amd64 go build -v -tags musl -o /bot

# Deploy the application binary into a lean image
FROM alpine:latest AS build-release-stage

WORKDIR /

# Download cURL for healthcheck
RUN apk add --no-cache curl

COPY --from=build-stage /bot /bot

EXPOSE 8000

ENTRYPOINT ["/bot"]