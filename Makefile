all: dist dist/index.js dist/static dist/static/main.js dist/views

dist:
	mkdir dist

dist/index.js: dist server/*
	npx esbuild \
		--outfile="$@" \
		--sourcemap \
		--bundle \
		--platform=node \
		--target=es2017 \
		server/index.ts

dist/static/main.js: client/*
	npx esbuild \
		--outfile="$@" \
		--sourcemap \
		--bundle \
		--platform=browser \
		--target=es2017 \
		client/main.ts

dist/static: static/*
	cp -r static dist

dist/views: views/*
	cp -r views dist

clean: 
	rm -rf dist
