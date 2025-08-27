/* eslint-disable no-undef */
;(function () {
  function addBadges(ui) {
    try {
      var system = ui && ui.getSystem && ui.getSystem()
      if (!system) return
      var specSel = system.specSelectors
      var spec = specSel && specSel.specJson && specSel.specJson()
      if (!spec) return
      var raw = (spec.toJS && spec.toJS()) || spec
      var paths = raw.paths || {}

      var container = document.querySelector('#swagger-ui')
      if (!container) return

      var ensureBadge = function (opblockEl, roles) {
        if (!opblockEl || !roles || !roles.length) return
        var summary = opblockEl.querySelector('.opblock-summary')
        if (!summary) return
        if (summary.querySelector('.role-badges')) return

        var wrap = document.createElement('span')
        wrap.className = 'role-badges'
        roles.forEach(function (r) {
          var b = document.createElement('span')
          b.className = `role-badge ${r.toLowerCase()}`
          b.textContent = r
          wrap.appendChild(b)
        })
        summary.appendChild(wrap)
      }

      var hasBearerSecurity = function (opObj, root) {
        var secList = []
        if (Array.isArray(opObj && opObj.security)) secList = secList.concat(opObj.security)
        if (Array.isArray(root && root.security)) secList = secList.concat(root.security)
        if (!secList.length) return false
        return secList.some(function (sec) {
          return Object.keys(sec || {}).some(function (key) {
            return String(key || '')
              .toLowerCase()
              .includes('bearer')
          })
        })
      }

      var tryRenderAll = function () {
        var opblocks = container.querySelectorAll('.opblock')
        opblocks.forEach(function (opblock) {
          var method = null
          opblock.classList.forEach(function (cls) {
            if (cls.indexOf('opblock-') === 0 && cls !== 'opblock') {
              method = cls.replace('opblock-', '')
            }
          })
          if (!method) {
            var methodEl = opblock.querySelector('.opblock-summary-method')
            method = methodEl && methodEl.textContent && methodEl.textContent.trim().toLowerCase()
          }
          if (!method) return

          var pathEl = opblock.querySelector('.opblock-summary-path a, .opblock-summary-path')
          var path = pathEl && pathEl.textContent && pathEl.textContent.trim()
          if (!path) return

          var p = paths[path]
          if (!p) return
          var opObj = p[method]
          if (!opObj) return
          var roles = opObj['x-roles']
          if ((!Array.isArray(roles) || !roles.length) && hasBearerSecurity(opObj, raw)) {
            roles = ['USER']
          }
          if (Array.isArray(roles) && roles.length) {
            ensureBadge(opblock, roles)
          }
        })
      }

      setTimeout(tryRenderAll, 300)

      // Observe further UI expansions/collapses
      var mo = new MutationObserver(function () {
        tryRenderAll()
      })
      mo.observe(container, { childList: true, subtree: true })
    } catch (e) {
      console.error('roles-badge plugin error:', e)
    }
  }

  window.addEventListener('load', function () {
    if (window.ui) {
      addBadges(window.ui)
    } else {
      // fallback if ui is created later
      var intv = setInterval(function () {
        if (window.ui) {
          clearInterval(intv)
          addBadges(window.ui)
        }
      }, 200)
    }
  })
})()
;(function () {
  function goToHash() {
    var hash = decodeURIComponent(location.hash || '')
    if (!hash.startsWith('#/')) return

    var parts = hash.slice(2).split('/')
    var tag = parts[0]

    var tagHeaders = document.querySelectorAll('.swagger-ui .opblock-tag')
    var tagHeader = Array.prototype.find.call(tagHeaders, function (el) {
      return (el.textContent || '').trim().startsWith(tag)
    })
    if (tagHeader) {
      var section = tagHeader.parentElement
      if (section && !section.classList.contains('is-open')) {
        tagHeader.click()
      }
    }

    setTimeout(function () {
      var link = document.querySelector('.opblock-summary-path a[href="' + hash + '"]')
      var op = link ? link.closest('.opblock') : null
      var opBtn = op ? op.querySelector('.opblock-control-arrow') : null
      if (op) {
        op.scrollIntoView({ behavior: 'smooth', block: 'start' })
        if (opBtn) {
          setTimeout(function () {
            opBtn.click()
          }, 100)
        }
      }
    }, 80)
  }

  window.addEventListener('hashchange', goToHash)
})()
