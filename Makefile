all: dist dist/index.js dist/static 

dist:
	mkdir dist

dist/index.js: dist server/*
	npx esbuild \
		--outfile='dist/index.js' \
		--sourcemap \
		--bundle \
		--platform=node \
		--target=es2017 \
		server/index.ts

dist/static: static/*
	cp -r static dist/static

clean: 
	rm -rf dist
