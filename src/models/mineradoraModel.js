const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = 'monitore-ouro-2026';

const database = require("../database/config");


async function buscarMineradoras() {
    const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key:  'caminho/dentro-do-bucket',
    });

    try {
        const resposta = await s3.send(command);
        // Converter a resposta em string
        const stringRes = await resposta.Body.transformToString();
        return JSON.parse(stringRes);
    } catch (erro) {
        if (erro.name === 'Key inválida') return null;
        throw erro;
    }
}

module.exports = {
  buscarMineradoras
}
