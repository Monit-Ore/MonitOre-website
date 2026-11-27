CREATE DATABASE monitore;
USE monitore;

-- ============================================================
-- 1. TABELA EMPRESA
-- ============================================================

CREATE TABLE empresa (
    id_empresa INT PRIMARY KEY AUTO_INCREMENT,
    razao_social VARCHAR(200) NOT NULL,
    cnpj CHAR(14) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL,
    tipo VARCHAR(45) NOT NULL
);


-- ============================================================
-- 2. TABELA ENDERECO
-- ============================================================

CREATE TABLE endereco (
    id_endereco INT PRIMARY KEY AUTO_INCREMENT,
    cep CHAR(8) NOT NULL,
    logradouro VARCHAR(200) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(100),
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(80) NOT NULL
);


-- ============================================================
-- 3. TABELA TORRE
-- ============================================================

CREATE TABLE torre (
    id_torre INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL,
    codigo VARCHAR(100) NOT NULL,
    monitoramento_ativo TINYINT(1) NOT NULL DEFAULT 1,

    fk_fabricante INT NOT NULL,
    fk_endereco INT NOT NULL,
    fk_mineradora INT NOT NULL,

    CONSTRAINT fk_torre_fabricante
        FOREIGN KEY (fk_fabricante)
        REFERENCES empresa(id_empresa),

    CONSTRAINT fk_torre_endereco
        FOREIGN KEY (fk_endereco)
        REFERENCES endereco(id_endereco),

    CONSTRAINT fk_torre_mineradora
        FOREIGN KEY (fk_mineradora)
        REFERENCES empresa(id_empresa)
);


-- ============================================================
-- 4. TABELA PC INDUSTRIAL
-- ============================================================

CREATE TABLE PC_Industrial (
    id_pc_industrial INT PRIMARY KEY AUTO_INCREMENT,
    nome CHAR(100) NOT NULL,
    hostname VARCHAR(100) NOT NULL UNIQUE,
    status_operacional VARCHAR(20) NOT NULL,
    fk_torre INT NOT NULL UNIQUE,
    uuid VARCHAR(45) NOT NULL UNIQUE,

    CONSTRAINT fk_pc_torre
        FOREIGN KEY (fk_torre)
        REFERENCES torre(id_torre)
);


-- ============================================================
-- 5. TABELA COMPONENTE
-- ============================================================

CREATE TABLE componente (
    id_componente INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL UNIQUE
);


-- ============================================================
-- 6. TABELA LIMITE_ALERTA
-- ============================================================

CREATE TABLE limite_alerta (
    fk_pc_industrial INT NOT NULL,
    fk_componente INT NOT NULL,
    atencao DECIMAL(10,2) NOT NULL,
    critico DECIMAL(10,2) NOT NULL,
    limite_alerta_diario INT UNSIGNED NOT NULL DEFAULT 10,

    PRIMARY KEY (fk_pc_industrial, fk_componente),

    CONSTRAINT fk_limite_pc
        FOREIGN KEY (fk_pc_industrial)
        REFERENCES PC_Industrial(id_pc_industrial),

    CONSTRAINT fk_limite_componente
        FOREIGN KEY (fk_componente)
        REFERENCES componente(id_componente),

    CONSTRAINT chk_limite_alerta_diario
        CHECK (limite_alerta_diario > 0)
);

-- Para bancos já existentes:
-- ALTER TABLE PC_Industrial
--   DROP COLUMN limite_alerta_diario;  -- apenas se a coluna antiga tiver sido criada
-- ALTER TABLE limite_alerta
--   ADD COLUMN limite_alerta_diario INT UNSIGNED NOT NULL DEFAULT 10 AFTER critico;


-- ============================================================
-- 7. TABELA USUARIO
-- ============================================================

CREATE TABLE usuario (
    id_usuario INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    cpf CHAR(11) NOT NULL UNIQUE,
    senha VARCHAR(100) NOT NULL,
    data_nascimento DATE,
    telefone VARCHAR(20),
    ultimo_acesso DATETIME,

    fk_empresa INT NOT NULL,

    cargo VARCHAR(100) NOT NULL,

    CONSTRAINT fk_usuario_empresa
        FOREIGN KEY (fk_empresa)
        REFERENCES empresa(id_empresa),

    CONSTRAINT chk_cargo
        CHECK (cargo IN ('Administrador', 'Operador'))
);

-- ============================================================
-- 8. TABELA PERMISSIONAMENTO
-- ============================================================

CREATE TABLE permissionamento (
    usuario_id_usuario INT NOT NULL,
    torre_id_torre INT NOT NULL,

    PRIMARY KEY (usuario_id_usuario, torre_id_torre),

    CONSTRAINT fk_permissionamento_usuario
        FOREIGN KEY (usuario_id_usuario)
        REFERENCES usuario(id_usuario),

    CONSTRAINT fk_permissionamento_torre
        FOREIGN KEY (torre_id_torre)
        REFERENCES torre(id_torre)
);



-- ============================================================
-- INSERINDO EMPRESAS
-- ============================================================

-- ============================================================
-- FABRICANTE
-- ============================================================

INSERT INTO empresa (
    razao_social,
    cnpj,
    email,
    tipo
)
VALUES (
    'MonitOre Sistemas Industriais Ltda.',
    '00000000000001',
    'contato@monitore.com.br',
    'Fabricante'
);


-- ============================================================
-- 2 MINERADORAS / CLIENTES
-- ============================================================

INSERT INTO empresa (
    razao_social,
    cnpj,
    email,
    tipo
)
VALUES
(
    'Vale S.A.',
    '33592510000154',
    'contato@vale.com',
    'Mineradora'
),

(
    'CSN Mineracao S.A.',
    '08189185000100',
    'contato@csn.com.br',
    'Mineradora'
);


-- ============================================================
-- ENDEREÇOS
-- ============================================================

INSERT INTO endereco (
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    estado
)
VALUES
(
    '35900000',
    'Avenida das Minas',
    '1000',
    NULL,
    'Centro',
    'Itabira',
    'Minas Gerais'
),

(
    '36415000',
    'Rodovia BR-040',
    '5000',
    'Unidade Industrial',
    'Zona Rural',
    'Congonhas',
    'Minas Gerais'
),

(
    '35420000',
    'Rodovia BR-262',
    '1200',
    'Unidade Operacional',
    'Zona Rural',
    'Mariana',
    'Minas Gerais'
),

(
    '35860000',
    'Avenida das Operacoes',
    '800',
    NULL,
    'Centro',
    'Conceicao do Mato Dentro',
    'Minas Gerais'
),

(
    '36420000',
    'Avenida Industrial',
    '1500',
    'Unidade Gerdau',
    'Distrito Industrial',
    'Ouro Branco',
    'Minas Gerais'
),

(
    '35685000',
    'Rodovia BR-381',
    '2200',
    NULL,
    'Zona Industrial',
    'Itatiaiucu',
    'Minas Gerais'
),

(
    '38183000',
    'Avenida Mineral',
    '700',
    NULL,
    'Distrito Industrial',
    'Araxá',
    'Minas Gerais'
),

(
    '38600000',
    'Rodovia MG-010',
    '3500',
    NULL,
    'Zona Rural',
    'Paracatu',
    'Minas Gerais'
),

(
    '68275000',
    'Rodovia PA-254',
    '100',
    NULL,
    'Zona Rural',
    'Porto Trombetas',
    'Pará'
),

(
    '29160000',
    'Avenida Siderurgia',
    '1800',
    NULL,
    'Distrito Industrial',
    'Serra',
    'Espírito Santo'
);


-- ============================================================
-- TORRES
--
-- Fabricante:
-- id_empresa = 1
--
-- Mineradoras:
-- Vale = 2
-- CSN  = 3
--
-- 3 TORRES NO TOTAL
-- ============================================================

INSERT INTO torre (
    nome,
    codigo,
    monitoramento_ativo,
    fk_fabricante,
    fk_endereco,
    fk_mineradora
)
VALUES

-- VALE
(
    'Torre Vale 01',
    'Torre-Vale-01',
    1,
    1,
    1,
    2
),

(
    'Torre Vale 02',
    'Torre-Vale-02',
    1,
    1,
    2,
    2
),

-- CSN
(
    'Torre CSN 01',
    'Torre-CSN-01',
    1,
    1,
    3,
    3
);


-- ============================================================
-- PC INDUSTRIAL
--
-- 1 PC INDUSTRIAL PARA CADA TORRE
-- TOTAL = 3 PCS INDUSTRIAIS
-- ============================================================

INSERT INTO PC_Industrial (
    nome,
    hostname,
    status_operacional,
    fk_torre,
    uuid
)
VALUES

(
    'PC-INDUSTRIAL-000000000000000000000001',
    'PC-VALE-01',
    'Ativo',
    1,
    '550e8400-e29b-41d4-a716-000000000001'
),

(
    'PC-INDUSTRIAL-000000000000000000000002',
    'PC-VALE-02',
    'Ativo',
    2,
    '550e8400-e29b-41d4-a716-000000000002'
),

(
    'PC-INDUSTRIAL-000000000000000000000003',
    'PC-CSN-01',
    'Ativo',
    3,
    '550e8400-e29b-41d4-a716-000000000003'
);


-- ============================================================
-- COMPONENTES
-- ============================================================

INSERT INTO componente (
    nome
)
VALUES
    ('CPU'),
    ('RAM'),
    ('DISCO');


-- ============================================================
-- LIMITES DE ALERTA
-- ============================================================

INSERT INTO limite_alerta (
    fk_pc_industrial,
    fk_componente,
    atencao,
    critico
)
VALUES

-- PC 01
(1, 1, 80.00, 90.00),
(1, 2, 80.00, 90.00),
(1, 3, 80.00, 90.00),

-- PC 02
(2, 1, 80.00, 90.00),
(2, 2, 80.00, 90.00),
(2, 3, 80.00, 90.00),

-- PC 03
(3, 1, 80.00, 90.00),
(3, 2, 80.00, 90.00),
(3, 3, 80.00, 90.00)
);


-- ============================================================
-- USUÁRIOS
-- ============================================================

INSERT INTO usuario (
    nome,
    email,
    cpf,
    senha,
    data_nascimento,
    telefone,
    ultimo_acesso,
    fk_empresa,
    cargo
)
VALUES

-- ============================================================
-- ADMINISTRADOR
-- ============================================================

(
    'Carlos Henrique Almeida',
    'carlos.almeida@monitore.com.br',
    '00000000001',
    '123456',
    '1990-05-15',
    '(11) 99999-1001',
    '2026-09-26 08:30:00',
    1,
    'Administrador'
),

-- ============================================================
-- OPERADORES
-- ============================================================

(
    'Mariana Souza Santos',
    'mariana.santos@monitore.com.br',
    '00000000002',
    '123456',
    '1995-03-22',
    '(11) 99999-1002',
    '2026-09-26 08:35:00',
    1,
    'Operador'
),

(
    'Rafael Oliveira Costa',
    'rafael.costa@monitore.com.br',
    '00000000003',
    '123456',
    '1993-07-10',
    '(11) 99999-1003',
    '2026-09-26 08:40:00',
    1,
    'Operador'
),

(
    'Juliana Martins Rocha',
    'juliana.rocha@monitore.com.br',
    '00000000004',
    '123456',
    '1997-11-05',
    '(11) 99999-1004',
    '2026-09-26 08:45:00',
    1,
    'Operador'
),

(
    'Lucas Ferreira Lima',
    'lucas.lima@monitore.com.br',
    '00000000005',
    '123456',
    '1994-01-18',
    '(11) 99999-1005',
    '2026-09-26 08:50:00',
    1,
    'Operador'
),

(
    'Amanda Rodrigues Silva',
    'amanda.silva@monitore.com.br',
    '00000000006',
    '123456',
    '1996-09-27',
    '(11) 99999-1006',
    '2026-09-26 08:55:00',
    1,
    'Operador'
),

(
    'Gabriel Pereira Mendes',
    'gabriel.mendes@monitore.com.br',
    '00000000007',
    '123456',
    '1992-12-03',
    '(11) 99999-1007',
    '2026-09-26 09:00:00',
    1,
    'Operador'
);


-- ============================================================
-- PERMISSIONAMENTO
-- ============================================================

INSERT INTO permissionamento (
    usuario_id_usuario,
    torre_id_torre
)
VALUES
(1, 1),
(1, 2),
(1, 3)
);
