const {AutoLanguageClient} = require('atom-languageclient');

class PhpLanguageClient extends AutoLanguageClient
{
    function getGrammarScopes()
    {
        return [
            'source.php',
            'php'
        ];
    }

    function getLanguageName()
    {
        return 'PHP';
    }

    function getServerName()
    {
        return 'PHP Language Server';
    }

    function getConnectionType()
    {
        return 'ipc';
    }

    function startServerProcess()
    {
        console.log("test");
        const startServer = require('intelephense-server');

        return super.spawnChildNode(
            [
                startServer,
                '--node-ipc',
            ],
            {
                stdio: [
                    null,
                    null,
                    null,
                    'ipc',
                ]
            }
        );
    }
}

module.exports = new PhpLanguageClient();
