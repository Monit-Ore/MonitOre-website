/*
 * MonitOre — helpers compartilhados.
 *
 * Este arquivo não dispara efeitos, requisições ou navegação por conta própria.
 * Cada página chama explicitamente as funções que precisa.
 */
(function () {
  'use strict';

  var COMPONENTES = Object.freeze([
    Object.freeze({ id: 1, nome: 'CPU' }),
    Object.freeze({ id: 2, nome: 'RAM' }),
    Object.freeze({ id: 3, nome: 'Disco' }),
  ]);

  var ROTULOS_COMPONENTES = Object.freeze({
    CPU: 'Porcentagem CPU',
    RAM: 'Uso da Memória RAM',
    Disco: 'Disponibilidade do Disco',
  });

  function escaparHTML(valor) {
    return String(valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function obterIniciais(nome, opcoes) {
    var config = opcoes || {};
    var original = String(nome == null ? '' : nome);
    var texto = original.trim();

    if (!texto) {
      return config.fallback || '';
    }

    var partes = texto.split(/\s+/).filter(Boolean);
    var letras = [];

    if (config.estilo === 'primeiro-ultimo') {
      letras = [partes[0][0], partes[partes.length - 1][0]];
    } else if (config.estilo === 'duas-palavras') {
      letras = partes.slice(0, 2).map(function (parte) {
        return parte[0];
      });
    } else {
      var primeiroEspaco = original.indexOf(' ');
      letras = [original[0]];
      if (primeiroEspaco !== -1 && original[primeiroEspaco + 1]) {
        letras.push(original[primeiroEspaco + 1]);
      }
    }

    var iniciais = letras.filter(Boolean).join('');
    return config.maiusculas ? iniciais.toUpperCase() : iniciais;
  }

  function definirTexto(id, valor, fallback) {
    var elemento = document.getElementById(id);
    if (!elemento) return;
    var textoVazio = valor === null || valor === undefined || valor === '';
    elemento.textContent = textoVazio
      ? (fallback === undefined ? '—' : fallback)
      : String(valor);
  }

  function preencherIdentidade(opcoes) {
    var config = opcoes || {};
    var nome = sessionStorage.getItem('NOME_USUARIO');
    var cargo = sessionStorage.getItem('CARGO_USUARIO');
    var exigirNome = config.exigirNome !== false;

    if (exigirNome && !nome) return;

    var nomeId = config.nomeId || 'nome_usuario';
    var cargoId = config.cargoId || 'cargo_usuario';
    var avatarId = config.avatarId || 'avatar_usuario';

    definirTexto(nomeId, nome || '', config.nomeFallback || '');

    var elementoCargo = document.getElementById(cargoId);
    if (elementoCargo) {
      elementoCargo.textContent = cargo || '';
    }

    var elementoAvatar = document.getElementById(avatarId);
    if (elementoAvatar) {
      elementoAvatar.textContent = obterIniciais(nome, config.iniciais || {});
    }

    if (config.segundoAvatarId) {
      var segundoAvatar = document.getElementById(config.segundoAvatarId);
      if (segundoAvatar) {
        segundoAvatar.textContent = obterIniciais(nome, config.iniciais || {});
      }
    }
  }

  function ativarMenu(idAtivo) {
    document.querySelectorAll('.menu_navegacao .item_menu').forEach(function (item) {
      item.classList.toggle('ativo', item.id === idAtivo);
    });
  }

  function alternarMenu() {
    document.body.classList.toggle('menu-aberto');
  }

  function sair() {
    sessionStorage.clear();
    window.location.href = './login.html';
  }

  function abrirPerfil() {
    window.location.href = '/meu_perfil.html';
  }

  function instalarChrome(opcoes) {
    var config = Object.assign(
      {
        identity: null,
        menu: false,
        logout: true,
        profileId: null,
        profileSelector: null,
        profileTeclado: false,
        onReady: null,
      },
      opcoes || {},
    );

    document.addEventListener('DOMContentLoaded', function () {
      if (config.identity) {
        preencherIdentidade(config.identity === true ? {} : config.identity);
      }

      if (config.menu) {
        var botaoMenu = document.querySelector('.btn-notificacao');
        if (botaoMenu) {
          botaoMenu.addEventListener('click', alternarMenu);
        }
      }

      if (config.logout) {
        var botaoSair = document.getElementById('botao_sair');
        if (botaoSair) {
          botaoSair.addEventListener('click', sair);
        }
      }

      var perfis = [];
      if (config.profileId) {
        var perfil = document.getElementById(config.profileId);
        if (perfil) perfis.push(perfil);
      }
      if (config.profileSelector) {
        document.querySelectorAll(config.profileSelector).forEach(function (item) {
          if (perfis.indexOf(item) === -1) perfis.push(item);
        });
      }

      perfis.forEach(function (perfil) {
        perfil.addEventListener('click', abrirPerfil);
        if (config.profileTeclado) {
          perfil.addEventListener('keydown', function (evento) {
            if (evento.key === 'Enter' || evento.key === ' ') {
              evento.preventDefault();
              abrirPerfil();
            }
          });
        }
      });

      if (typeof config.onReady === 'function') {
        config.onReady();
      }
    });
  }

  function preencherSelect(idSelect, itens, chaveValor, chaveTexto, textoPadrao, opcoes) {
    var select = document.getElementById(idSelect);
    if (!select) return;

    var config = opcoes || {};
    var atributoDesabilitado = config.placeholderDesabilitado ? ' disabled' : '';
    select.innerHTML = '<option value=""' + atributoDesabilitado + ' selected>' + textoPadrao + '</option>';

    (itens || []).forEach(function (item) {
      var option = document.createElement('option');
      option.value = item[chaveValor];
      option.textContent = item[chaveTexto];
      select.appendChild(option);
    });
  }

  function preencherSelectEstatico(idSelect, itens, textoPadrao) {
    var select = document.getElementById(idSelect);
    if (!select) return;

    var rotulo = textoPadrao || 'Selecione uma opção';
    select.innerHTML = '<option value="" selected>' + rotulo + '</option>';

    (itens || []).forEach(function (item) {
      var option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.nome;
      select.appendChild(option);
    });
  }

  async function buscarCEP(cep, opcoes) {
    var config = opcoes || {};
    var campos = Object.assign(
      {
        cidade: 'cidade_ipt',
        uf: 'uf_ipt',
        bairro: 'bairro_ipt',
        logradouro: 'logradouro_ipt',
      },
      config.campos || {},
    );
    var chavesDados = {
      cidade: 'localidade',
      uf: 'uf',
      bairro: 'bairro',
      logradouro: 'logradouro',
    };

    try {
      if (!/^\d{8}$/.test(cep)) {
        throw new Error('CEP inválido. Use apenas 8 dígitos numéricos.');
      }

      var response = await fetch('https://viacep.com.br/ws/' + cep + '/json/');
      if (!response.ok) {
        throw new Error('Erro na requisição: ' + response.status);
      }

      var data = await response.json();
      if (data.erro) {
        throw new Error('CEP não encontrado.');
      }

      Object.keys(campos).forEach(function (chave) {
        var campo = document.getElementById(campos[chave]);
        if (campo) {
          campo.value = data[chavesDados[chave]] || '';
          campo.readOnly = true;
        }
      });

      if (typeof config.onEncontrado === 'function') {
        config.onEncontrado(data);
      }
    } catch (error) {
      console.error('Erro:', error.message);
    }
  }

  function validarMetrica(opcoes) {
    var config = opcoes || {};
    var fkComponente = Number(config.fkComponente);

    if (!fkComponente) {
      return 'Selecione um componente.';
    }
    if (!config.alertaCritico || config.alertaCritico <= 0 || config.alertaCritico > 100) {
      return 'Informe uma porcentagem válida (1 a 100) para o Alerta Crítico.';
    }
    if (!config.alertaAtencao || config.alertaAtencao <= 0 || config.alertaAtencao > 100) {
      return 'Informe uma porcentagem válida (1 a 100) para o Alerta Atenção.';
    }
    if (config.jaAdicionado) {
      return 'Esse componente já foi adicionado.';
    }
    return null;
  }

  function rotuloComponente(nomeComponente) {
    return ROTULOS_COMPONENTES[nomeComponente] || nomeComponente;
  }

  window.MonitOre = Object.freeze({
    COMPONENTES: COMPONENTES,
    escaparHTML: escaparHTML,
    obterIniciais: obterIniciais,
    definirTexto: definirTexto,
    preencherIdentidade: preencherIdentidade,
    ativarMenu: ativarMenu,
    alternarMenu: alternarMenu,
    sair: sair,
    abrirPerfil: abrirPerfil,
    instalarChrome: instalarChrome,
    preencherSelect: preencherSelect,
    preencherSelectEstatico: preencherSelectEstatico,
    buscarCEP: buscarCEP,
    validarMetrica: validarMetrica,
    rotuloComponente: rotuloComponente,
  });
})();
