/*
 * Die Glocke — DokuWiki plugin scaffold generator (pure logic, no DOM).
 *
 * Exports `buildPluginFiles(config)` -> [{name, content}]
 * Dual-export: window.DokuWikiGenerator + module.exports
 */
(function (root) {
  'use strict';

  var PHP_RESERVED = {
    abstract: 1, and: 1, array: 1, as: 1, break: 1, callable: 1, case: 1, catch: 1,
    class: 1, clone: 1, const: 1, continue: 1, declare: 1, default: 1, die: 1, do: 1,
    echo: 1, else: 1, elseif: 1, empty: 1, enddeclare: 1, endfor: 1, endforeach: 1,
    endif: 1, endswitch: 1, endwhile: 1, eval: 1, exit: 1, extends: 1, final: 1,
    finally: 1, fn: 1, for: 1, foreach: 1, function: 1, global: 1, goto: 1, if: 1,
    implements: 1, include: 1, include_once: 1, instanceof: 1, insteadof: 1, interface: 1,
    isset: 1, list: 1, match: 1, namespace: 1, new: 1, or: 1, print: 1, private: 1,
    protected: 1, public: 1, readonly: 1, require: 1, require_once: 1, return: 1, static: 1,
    switch: 1, throw: 1, trait: 1, try: 1, unset: 1, use: 1, var: 1, while: 1, xor: 1,
    yield: 1
  };

  var VALID_TYPES = { syntax: 1, action: 1, admin: 1, helper: 1 };
  var VALID_LEVELS = { basic: 1, advanced: 1, pro: 1 };

  function sanitizeBase(name) {
    var base = String(name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
    return base || 'my_plugin';
  }

  function phpIdent(name, fallback) {
    var id = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    if (!id || /^[0-9]/.test(id) || PHP_RESERVED[id]) {
      id = (fallback || 'plugin') + (id ? '_' + id : '');
      id = id.replace(/^_+|_+$/g, '');
      if (/^[0-9]/.test(id) || PHP_RESERVED[id]) { id = 'p_' + id; }
    }
    return id;
  }

  function sanitizeText(s) {
    return String(s == null ? '' : s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
  }

  function todayIso() {
    return new Date().toISOString().split('T')[0];
  }

  function buildPluginInfoTxt(cfg) {
    var lines = [
      'base     ' + cfg.plugin_base,
      'author   ' + sanitizeText(cfg.author),
      'email    ' + sanitizeText(cfg.email),
      'date     ' + todayIso(),
      'name     ' + sanitizeText(cfg.plugin_name),
      'desc     ' + sanitizeText(cfg.desc),
      'url      ' + sanitizeText(cfg.url),
      'level    ' + cfg.complexity
    ];
    return lines.join('\n') + '\n';
  }

  function buildSyntaxPhp(base, level) {
    var L = [];
    L.push('<?php');
    L.push('/**');
    L.push(' * DokuWiki Syntax Plugin ' + base);
    L.push(' */');
    L.push("if(!defined('DOKU_INC')) die();");
    L.push('');
    L.push('class syntax_plugin_' + base + ' extends DokuWiki_Syntax_Plugin {');
    L.push('');
    L.push('    public function getType() {');
    L.push("        return 'substition';");
    L.push('    }');
    L.push('');
    L.push('    public function getSort() {');
    L.push('        return 32;');
    L.push('    }');
    if (level !== 'basic') {
      L.push('');
      L.push('    public function getPType() {');
      L.push("        return 'normal';");
      L.push('    }');
    }
    L.push('');
    L.push('    public function connectTo($mode) {');
    if (level === 'pro') {
      L.push("        $this->Lexer->addSpecialPattern('<" + base + "[^>]*>.*?</" + base + ">', $mode, 'plugin_" + base + "');");
      L.push("        $this->Lexer->addEntryPattern('<" + base + ">', $mode, 'plugin_" + base + "_open');");
      L.push("        $this->Lexer->addExitPattern('</" + base + ">', $mode, 'plugin_" + base + "_close');");
    } else {
      L.push("        $this->Lexer->addSpecialPattern('<" + base + "[^>]*>.*?</" + base + ">', $mode, 'plugin_" + base + "');");
    }
    L.push('    }');
    L.push('');
    L.push('    public function handle($match, $state, $pos, Doku_Handler $handler) {');
    if (level === 'pro') {
      L.push('        switch ($state) {');
      L.push('            case DOKU_LEXER_ENTER:');
      L.push("                $handler->addPluginCall('" + base + "', $pos, array('open'));");
      L.push('                break;');
      L.push('            case DOKU_LEXER_UNMATCHED:');
      L.push("                $handler->addPluginCall('" + base + "', $pos, array('body', $match));");
      L.push('                break;');
      L.push('            case DOKU_LEXER_EXIT:');
      L.push("                $handler->addPluginCall('" + base + "', $pos, array('close'));");
      L.push('                break;');
      L.push('        }');
      L.push('        return true;');
    } else {
      L.push('        return array($match);');
    }
    L.push('    }');
    L.push('');
    L.push('    public function render($mode, Doku_Renderer $renderer, $data) {');
    L.push("        if ($mode !== 'xhtml') return false;");
    if (level === 'pro') {
      L.push("        if ($data[0] === 'open') {");
      L.push("            $renderer->doc .= '<div class=\"" + base + "-container\">';");
      L.push('            return true;');
      L.push('        }');
      L.push("        if ($data[0] === 'close') {");
      L.push("            $renderer->doc .= '</div>';");
      L.push('            return true;');
      L.push('        }');
      L.push("        $renderer->doc .= hsc(isset($data[1]) ? $data[1] : '');");
    } else if (level === 'advanced') {
      L.push("        $renderer->doc .= '<div class=\"" + base + "-container\">';");
      L.push('        $renderer->doc .= hsc($data[0]);');
      L.push("        $renderer->doc .= '</div>';");
    } else {
      L.push('        $renderer->doc .= hsc($data[0]);');
    }
    L.push('        return true;');
    L.push('    }');
    L.push('}');
    L.push('');
    return L.join('\n');
  }

  function buildActionPhp(base, level) {
    var L = [];
    L.push('<?php');
    L.push('/**');
    L.push(' * DokuWiki Action Plugin ' + base);
    L.push(' */');
    L.push("if(!defined('DOKU_INC')) die();");
    L.push('');
    L.push('class action_plugin_' + base + ' extends DokuWiki_Action_Plugin {');
    L.push('');
    L.push('    public function register(Doku_Event_Handler $controller) {');
    L.push("        $controller->register_hook('DOKUWIKI_STARTED', 'AFTER', $this, 'handleStart');");
    if (level !== 'basic') {
      L.push("        $controller->register_hook('TPL_METAHEADER_OUTPUT', 'BEFORE', $this, 'handleMeta');");
    }
    if (level === 'pro') {
      L.push("        $controller->register_hook('HTML_OUTPUT', 'BEFORE', $this, 'handleOutput');");
    }
    L.push('    }');
    L.push('');
    L.push('    public function handleStart(Doku_Event $event, $param) {');
    if (level === 'pro') {
      L.push('        global $conf;');
      L.push('        // Initialization hook — extend as needed');
    } else {
      L.push('        // Initialization logic');
    }
    L.push('    }');
    if (level !== 'basic') {
      L.push('');
      L.push('    public function handleMeta(Doku_Event $event, $param) {');
      L.push("        $event->data['link'][] = array(");
      L.push("            'rel' => 'stylesheet',");
      L.push("            'type' => 'text/css',");
      L.push("            'href' => DOKU_BASE . 'lib/plugins/" + base + "/style/all.css'");
      L.push('        );');
      L.push('    }');
    }
    if (level === 'pro') {
      L.push('');
      L.push('    public function handleOutput(Doku_Event $event, $param) {');
      L.push('        // Output filter hook stub');
      L.push('    }');
    }
    L.push('}');
    L.push('');
    return L.join('\n');
  }

  function buildAdminPhp(base, level) {
    var L = [];
    L.push('<?php');
    L.push('/**');
    L.push(' * DokuWiki Admin Plugin ' + base);
    L.push(' */');
    L.push("if(!defined('DOKU_INC')) die();");
    L.push('');
    L.push('class admin_plugin_' + base + ' extends DokuWiki_Admin_Plugin {');
    L.push('');
    L.push('    public function getMenuSort() {');
    L.push('        return 200;');
    L.push('    }');
    L.push('');
    L.push('    public function forAdminOnly() {');
    L.push('        return true;');
    L.push('    }');
    L.push('');
    L.push('    public function handle() {');
    L.push('        global $INPUT;');
    if (level === 'pro') {
      L.push("        if (!$INPUT->post->bool('save')) return;");
      L.push("        msg($this->getLang('saved'), 1);");
    } else {
      L.push("        if ($INPUT->post->has('save')) {");
      L.push("            msg($this->getLang('saved'), 1);");
      L.push('        }');
    }
    L.push('    }');
    L.push('');
    L.push('    public function html() {');
    if (level === 'pro') {
      L.push("        ptln('<h1>' . $this->getLang('menu') . '</h1>');");
      L.push('        $form = new dokuwiki\\Form\\Form();');
      L.push("        $form->addTextInput('setting', $this->getLang('setting_label'))");
      L.push("            ->attr('value', $this->getConf('option1'));");
      L.push("        $form->addButton('save', $this->getLang('save'));");
      L.push('        ptln($form->toHTML());');
    } else {
      L.push("        ptln('<h1>' . $this->getLang('menu') . '</h1>');");
      L.push("        ptln('<p>' . $this->getLang('intro') . '</p>');");
    }
    L.push('    }');
    L.push('}');
    L.push('');
    return L.join('\n');
  }

  function buildHelperPhp(base, level) {
    var L = [];
    L.push('<?php');
    L.push('/**');
    L.push(' * DokuWiki Helper Plugin ' + base);
    L.push(' */');
    L.push("if(!defined('DOKU_INC')) die();");
    L.push('');
    L.push('class helper_plugin_' + base + ' extends DokuWiki_Helper_Plugin {');
    L.push('');
    L.push('    public function getMethods() {');
    L.push('        return array(');
    L.push('            array(');
    L.push("                'name' => 'getData',");
    L.push("                'desc' => 'Returns processed data',");
    L.push("                'params' => array('id' => 'string'),");
    L.push("                'return' => array('data' => 'array')");
    L.push('            )');
    if (level !== 'basic') {
      L.push('            ,array(');
      L.push("                'name' => 'getInfo',");
      L.push("                'desc' => 'Returns plugin info',");
      L.push("                'params' => array(),");
      L.push("                'return' => array('info' => 'array')");
      L.push('            )');
    }
    L.push('        );');
    L.push('    }');
    L.push('');
    L.push('    public function getData($id) {');
    if (level === 'pro') {
      L.push('        $id = trim($id);');
      L.push('        if ($id === \'\') return array();');
      L.push("        return array('id' => $id, 'timestamp' => time(), 'plugin' => '" + base + "');");
    } else {
      L.push("        return array('id' => $id, 'timestamp' => time());");
    }
    L.push('    }');
    if (level !== 'basic') {
      L.push('');
      L.push('    public function getInfo() {');
      L.push("        return array('base' => '" + base + "', 'version' => '1.0');");
      L.push('    }');
    }
    L.push('}');
    L.push('');
    return L.join('\n');
  }

  function buildActionHookStub(base) {
    var L = [];
    L.push('<?php');
    L.push('/**');
    L.push(' * Action hook stub for ' + base + ' (pro level)');
    L.push(' */');
    L.push("if(!defined('DOKU_INC')) die();");
    L.push('');
    L.push('class action_plugin_' + base + '_hooks extends DokuWiki_Action_Plugin {');
    L.push('');
    L.push('    public function register(Doku_Event_Handler $controller) {');
    L.push("        $controller->register_hook('PLUGIN_LOAD', 'BEFORE', $this, 'handlePluginLoad');");
    L.push('    }');
    L.push('');
    L.push('    public function handlePluginLoad(Doku_Event $event, $param) {');
    L.push('        // Hook stub — wire admin/helper integration here');
    L.push('    }');
    L.push('}');
    L.push('');
    return L.join('\n');
  }

  function buildHelperHookStub(base) {
    var L = [];
    L.push('<?php');
    L.push('/**');
    L.push(' * Helper hook stub for ' + base + ' (pro level)');
    L.push(' */');
    L.push("if(!defined('DOKU_INC')) die();");
    L.push('');
    L.push('class helper_plugin_' + base + '_api extends DokuWiki_Helper_Plugin {');
    L.push('');
    L.push('    public function getMethods() {');
    L.push('        return array(array(');
    L.push("            'name' => 'registerHooks',");
    L.push("            'desc' => 'Register cross-plugin hooks',");
    L.push("            'params' => array(),");
    L.push("            'return' => array('ok' => 'bool')");
    L.push('        ));');
    L.push('    }');
    L.push('');
    L.push('    public function registerHooks() {');
    L.push('        return true;');
    L.push('    }');
    L.push('}');
    L.push('');
    return L.join('\n');
  }

  function buildTypePhp(type, base, level) {
    if (type === 'syntax') return buildSyntaxPhp(base, level);
    if (type === 'action') return buildActionPhp(base, level);
    if (type === 'admin') return buildAdminPhp(base, level);
    if (type === 'helper') return buildHelperPhp(base, level);
    return buildSyntaxPhp(base, level);
  }

  function normalizeConfig(raw) {
    var cfg = raw || {};
    var type = String(cfg.plugin_type || 'syntax').toLowerCase();
    if (!VALID_TYPES[type]) type = 'syntax';
    var level = String(cfg.complexity || cfg.plugin_level || 'advanced').toLowerCase();
    if (!VALID_LEVELS[level]) level = 'advanced';
    var assets = cfg.assets || {};
    return {
      plugin_base: sanitizeBase(cfg.plugin_base),
      plugin_name: sanitizeText(cfg.plugin_name) || sanitizeBase(cfg.plugin_base),
      author: sanitizeText(cfg.author),
      email: sanitizeText(cfg.email),
      url: sanitizeText(cfg.url),
      desc: sanitizeText(cfg.desc),
      plugin_type: type,
      complexity: level,
      assets: {
        css: assets.css !== false,
        js: assets.js !== false,
        conf: assets.conf !== false,
        lang: assets.lang !== false
      }
    };
  }

  function buildPluginFiles(config) {
    var cfg = normalizeConfig(config);
    var base = cfg.plugin_base;
    var type = cfg.plugin_type;
    var level = cfg.complexity;
    var files = [];

    files.push({ name: 'plugin.info.txt', content: buildPluginInfoTxt(cfg) });
    files.push({ name: type + '.php', content: buildTypePhp(type, base, level) });

    if (cfg.assets.css) {
      files.push({
        name: 'style/all.css',
        content: '/* Styles for ' + cfg.plugin_name + ' */\n.' + base + '-container {\n    padding: 0.5rem;\n}\n'
      });
    }
    if (cfg.assets.js) {
      files.push({
        name: 'script.js',
        content: "/* JS for " + cfg.plugin_name + " */\n(function(){\n    'use strict';\n    console.log('" + base + " loaded');\n})();\n"
      });
    }

    var includeConf = cfg.assets.conf && level !== 'basic';
    if (includeConf) {
      files.push({
        name: 'conf/default.php',
        content: "<?php\n$conf['enabled'] = 1;\n$conf['option1'] = 'default_value';\n"
      });
      files.push({
        name: 'conf/metadata.php',
        content: "<?php\n$meta['enabled'] = array('onoff');\n$meta['option1'] = array('string');\n"
      });
    }

    var includeLang = cfg.assets.lang && (level === 'pro' || level === 'advanced');
    if (includeLang) {
      files.push({
        name: 'lang/en/lang.php',
        content: "<?php\n$lang['menu'] = '" + cfg.plugin_name.replace(/'/g, "\\'") + " Settings';\n$lang['saved'] = 'Settings saved.';\n$lang['intro'] = 'Configure the plugin.';\n$lang['setting_label'] = 'Option 1';\n$lang['save'] = 'Save';\n"
      });
      files.push({
        name: 'lang/de/lang.php',
        content: "<?php\n$lang['menu'] = '" + cfg.plugin_name.replace(/'/g, "\\'") + " Einstellungen';\n$lang['gespeichert'] = 'Gespeichert.';\n$lang['intro'] = 'Plugin konfigurieren.';\n$lang['setting_label'] = 'Option 1';\n$lang['save'] = 'Speichern';\n$lang['saved'] = 'Gespeichert.';\n"
      });
    }

    if (level === 'pro' && type !== 'action') {
      files.push({ name: 'action.php', content: buildActionHookStub(base) });
    }
    if (level === 'pro' && type !== 'helper') {
      files.push({ name: 'helper.php', content: buildHelperHookStub(base) });
    }

    files.push({
      name: 'README.md',
      content: '# ' + cfg.plugin_name + '\n\n' + (cfg.desc || 'A DokuWiki plugin.') + '\n\n## Installation\n\nExtract to `lib/plugins/' + base + '/`\n\n## Author\n\n' + cfg.author + '\n'
    });

    return files;
  }

  var api = {
    buildPluginFiles: buildPluginFiles,
    sanitizeBase: sanitizeBase,
    phpIdent: phpIdent,
    normalizeConfig: normalizeConfig
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.DokuWikiGenerator = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
