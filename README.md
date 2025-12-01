# in-season-stanley-cup

## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn serve
```

### Compiles and minifies for production
```
yarn build
```

### Lints and fixes files
```
yarn lint
```

### Caching and deployment
- Asset and API caching guidance (CloudFront + S3 + Lambda headers) lives in `docs/caching.md`.
- Vue build output already emits hashed filenames; serve built assets from an edge cache (e.g., CloudFront) with long-lived `Cache-Control` headers and short TTLs for HTML.

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
