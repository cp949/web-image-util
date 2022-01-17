const shell = require('shelljs')
const fs = require('fs')

function updatePackageDistJson() {
    const fromPkg = JSON.parse(fs.readFileSync('package.json'))
    const toPkg = JSON.parse(fs.readFileSync('package-dist.json'))

    toPkg.version = fromPkg.version
    toPkg.bugs = fromPkg.bugs
    toPkg.homepage = fromPkg.homepage
    toPkg.keywords = fromPkg.keywords
    toPkg.description = fromPkg.description
    fs.writeFileSync('package-dist.json', JSON.stringify(toPkg, null, 4))
}

async function main() {
    shell.rm('-rf', 'dist')
    shell.mkdir('dist')
    shell.cp('-rf', './build/cjs', 'dist/')
    shell.cp('-rf', './build/es', 'dist/')
    updatePackageDistJson()
    shell.cp('-rf', 'package-dist.json', 'dist/package.json')
    shell.cp('-rf', 'README.md', 'dist/')
}

main()
