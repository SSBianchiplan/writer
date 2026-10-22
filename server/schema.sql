-- GPlanSiS|Writer — esquema do servidor (PostgreSQL 16+). Idempotente: roda a cada partida.
-- Usuários com papel + permissões, sessões, documentos versionados com compartilhamento,
-- lixeira e trava de edição; notas privadas por usuário; registro de acessos à parte.
create schema if not exists writer;
set search_path = writer;

create table if not exists usuarios (
  id            bigserial primary key,
  login         text not null,                  -- e-mail
  nome          text not null,
  cargo         text,
  papel         text not null check (papel in ('ADMIN','EDITOR','REVISOR','LEITOR')),
  permissoes    text[],                         -- null = padrão do papel
  ativo         boolean not null default true,
  master        boolean not null default false, -- administrador master: não rebaixa, não desativa
  senha_hash    text not null,
  trocar_senha  boolean not null default true,
  falhas        int not null default 0,
  bloqueado_ate timestamptz,
  avatar        bytea,
  avatar_tipo   text,
  avatar_ver    int not null default 0,
  prefs         jsonb not null default '{}'::jsonb,
  pastas        jsonb not null default '["Projetos","Reuniões","Ideias"]'::jsonb,  -- pastas do módulo Notas
  pastas_ms     bigint not null default 0,
  criado_em     timestamptz not null default now(),
  criado_por    text,
  atualizado_em timestamptz not null default now(),
  ultimo_login  timestamptz,
  constraint master_e_admin check (not master or (papel = 'ADMIN' and ativo)),
  constraint avatar_limite check (avatar is null or octet_length(avatar) <= 400000)
);
create unique index if not exists usuarios_login_uk on usuarios (lower(login));

create table if not exists sessoes (
  token_hash  text primary key,
  usuario_id  bigint not null references usuarios(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz not null,
  ultimo_uso  timestamptz not null default now(),
  ip          text,
  ua          text
);
create index if not exists sessoes_usuario_ix on sessoes (usuario_id);

-- O id é gerado no navegador (o editor cria o documento antes de falar com o servidor).
create table if not exists documentos (
  id             text primary key check (id ~ '^[A-Za-z0-9_-]{4,64}$'),
  dono_id        bigint not null references usuarios(id),
  titulo         text not null,
  dados          jsonb not null,                -- o objeto do editor (html, layout, comentários, notas de rodapé)
  versao         int not null default 1,
  bytes          int not null default 0,
  palavras       int not null default 0,
  equipe         text check (equipe in ('LER','EDITAR')),   -- null = só convidados
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por text,
  excluido_em    timestamptz,                   -- não nulo = na lixeira
  editando_id    bigint references usuarios(id) on delete set null,  -- trava de edição (renovada a cada 25 s)
  editando_ate   timestamptz
);
create index if not exists documentos_dono_ix on documentos (dono_id, atualizado_em desc);
create index if not exists documentos_equipe_ix on documentos (equipe) where equipe is not null and excluido_em is null;

create table if not exists documento_acesso (
  documento_id text not null references documentos(id) on delete cascade,
  usuario_id   bigint not null references usuarios(id) on delete cascade,
  nivel        text not null check (nivel in ('LER','EDITAR')),
  primary key (documento_id, usuario_id)
);
create index if not exists documento_acesso_usuario_ix on documento_acesso (usuario_id);

-- Histórico: um retrato a cada 10 min de edição (ou quando muda o autor), até 40 por documento.
create table if not exists documento_versoes (
  documento_id text not null references documentos(id) on delete cascade,
  versao       int not null,
  titulo       text not null,
  dados        jsonb not null,
  bytes        int not null,
  palavras     int not null default 0,
  salvo_em     timestamptz not null default now(),
  salvo_por    text,
  primary key (documento_id, versao)
);

-- Notas são privadas: a chave é (dono, id). atualizado_ms é o relógio do editor (updatedAt).
create table if not exists notas (
  dono_id       bigint not null references usuarios(id) on delete cascade,
  id            text not null check (id ~ '^[A-Za-z0-9_-]{4,64}$'),
  dados         jsonb not null,
  atualizado_ms bigint not null default 0,
  bytes         int not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (dono_id, id)
);

create table if not exists acessos (
  id         bigserial primary key,
  ts         timestamptz not null default now(),
  usuario_id bigint,
  login      text,
  evento     text not null,
  ip         text,
  ua         text,
  detalhe    text
);
create index if not exists acessos_ts_ix on acessos (ts desc);

-- Configurações do sistema editáveis pelo painel (ex.: Assistente IA).
-- Segredos ficam cifrados (Fernet, chave em WRITER_SEGREDO no .env), nunca em claro.
create table if not exists config (
  chave          text primary key,
  valor          jsonb not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);

-- Integração com o GPlanSiS|Docs: cada documento enviado vira um documento no Docs (lista mestra, revisões,
-- verificação). O estado (revisões, situação, comentários) chega por evento assinado e fica aqui em cache.
create table if not exists docs_vinculo (
  documento_id   text primary key references documentos(id) on delete cascade,
  doc_id         text not null unique,
  projeto_id     text,
  projeto_codigo text,
  codigo         text,
  titulo         text,
  revisao_id     text,
  revisao_label  text,
  revisao_status text,
  finalidade     text,
  estado         jsonb not null default '{}'::jsonb,
  versao_enviada int,
  enviado_em     timestamptz,
  enviado_por    text,
  ultimo_evento  bigint not null default 0,
  atualizado_em  timestamptz not null default now()
);

create table if not exists sso_nonce (
  nonce     text primary key,
  expira_em timestamptz not null
);
