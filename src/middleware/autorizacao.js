const path = require("path");
const usuarioModel = require("../models/usuarioModel");
const publicas = new Set([
  "/index.html",
  "/sobre.html",
  "/equipe.html",
  "/login.html",
]);
const destino = (cargo) =>
  cargo === "Suporte" ? "/dashboard-suporte.html" : "/selecao_torre.html";

async function protegerAcesso(req, res, next) {
  let rota;
  try {
    rota = path.posix
      .normalize(decodeURIComponent(req.path).replace(/\\/g, "/"))
      .toLowerCase()
      .replace(/\/$/, "");
  } catch {
    return res.sendStatus(400);
  }
  if (
    req.method === "POST" &&
    ["/usuarios/autenticar", "/usuarios/sair"].includes(rota)
  )
    return next();
  // O Windows aceita pontos/espaços finais como aliases de nomes de arquivos.
  if (rota.includes(":")) return res.sendStatus(400);
  rota = rota
    .split("/")
    .map((parte) => parte.replace(/[. ]+$/, ""))
    .join("/");
  const pagina = rota.endsWith(".html") && !publicas.has(rota);
  const api = /^\/(usuarios|torres|empresas|suporte|dashboard|dashboard-processos)(\/|$)/.test(rota);
  if (!pagina && !api) return next();
  res.set("Cache-Control", "no-store");
  const negar = (status, mensagem, cargo) =>
    pagina
      ? res.redirect(status === 401 ? "/login.html" : destino(cargo))
      : res.status(status).json({ mensagem });
  if (!req.session || !req.session.ID_USUARIO)
    return negar(401, "Faça login novamente.");
  try {
    const usuarios = await usuarioModel.buscarSessaoPorId(
      req.session.ID_USUARIO,
    );
    const usuario = usuarios[0];
    if (
      !usuario ||
      !["Administrador", "Operador", "Suporte"].includes(usuario.cargo)
    ) {
      return req.session.destroy(() =>
        negar(401, "Sessão inválida. Faça login novamente."),
      );
    }
    const cargo = usuario.cargo;
    req.session.CARGO_USUARIO = cargo;
    req.session.FK_EMPRESA_USUARIO = usuario.fk_empresa;
    if (rota === "/usuarios/sessao" && req.method === "GET") {
      return res.json({ cargo, idUsuario: usuario.id_usuario });
    }
    const suporte = pagina
      ? rota === "/dashboard-suporte.html"
      : rota.startsWith("/suporte/") || rota === "/suporte";
    if ((cargo === "Suporte") !== suporte)
      return negar(
        403,
        "Você não tem permissão para acessar esta área.",
        cargo,
      );
    if (rota === "/dashboard-gerente.html")
      return negar(403, "Esta dashboard foi removida da navegação.", cargo);
    const paginasAdministrador = new Set([
      "/dashboard_capacidade_tendencias.html",
      "/dashboard_proc_geral.html", "/cadastro_mineradora.html",
      "/visualizacao_usuarios.html", "/editar_usuario.html", "/cadastro.html",
      "/cadastro_torre.html", "/alteracao_torre.html",
    ]);
    if (cargo !== "Administrador" && (
      paginasAdministrador.has(rota) ||
      rota === "/dashboard/capacidade" ||
      rota === "/dashboard/visao-executiva" ||
      /^\/dashboard-processos(\/|$)/.test(rota)
    )) return negar(403, "Você não tem permissão para acessar esta área.", cargo);
    if (
      ["/usuarios/cadastrar", "/usuarios/atualizarcargo"].includes(rota) &&
      cargo !== "Administrador"
    ) {
      return negar(
        403,
        "Apenas administradores podem gerenciar cargos e cadastrar usuários.",
        cargo,
      );
    }
    return next();
  } catch (erro) {
    console.error("Erro ao validar sessão:", erro.message);
    return res
      .status(500)
      .json({ mensagem: "Não foi possível validar sua sessão." });
  }
}
module.exports = { protegerAcesso };
