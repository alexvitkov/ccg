tsc:                  dist/tsc/server/index.js     dist/tsc/client     dist/tsc/client/main.js     dist/tsc/views
esbuild:              dist/esbuild/server/index.js dist/esbuild/client dist/esbuild/client/main.js dist/esbuild/views 

dist/tsc/server/index.js: src/*.ts src/server/*.ts
	npx tsc -p tsconfig-server.json

dist/tsc/views: src/views/*
	cp -r src/views dist/tsc

dist/tsc/client: src/static/*
	mkdir -p dist/tsc/client
	cp src/static/* dist/tsc/client

dist/tsc/client/main.js: src/*.ts src/client/*.ts
	npx tsc -p tsconfig-client.json

dist/esbuild:
	mkdir -p dist/esbuild/server

dist/esbuild/server/index.js: dist/esbuild src/server/* src/*.ts
	npx esbuild \
		--outfile="$@" \
		--sourcemap \
		--bundle \
		--platform=node \
		--target=es2017 \
		src/server/index.ts

dist/esbuild/client/main.js: dist/esbuild/client src/client/* src/*.ts
	npx esbuild \
		--outfile="$@" \
		--sourcemap \
		--bundle \
		--platform=browser \
		--target=es2017 \
		src/client/main.ts

dist/esbuild/views: src/views/*
	cp -r src/views dist/esbuild

dist/esbuild/client: src/static/*
	mkdir -p dist/esbuild/client
	cp src/static/* dist/esbuild/client

clean: 
	rm -rf dist
