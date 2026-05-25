with open(r'D:\Project_building\SparkLearn\ui-prototypes\phase2-complete-ui\学而思 SparkLearn 全页面学习闭环原型.html', 'r', encoding='utf-8') as f:
    content = f.read()

old = "  const pathBranches = document.querySelectorAll('.nav-branch');\n  const branchPanels = document.querySelectorAll('.branch-panel');\n  const pathBranchAdvice = {\n    weak: '\u5148\u8d70\u8865\u5f31\u8def\u5f84\u66f4\u7a33\u3002\u6211\u4f1a\u5148\u7528\u77ed\u8bb2\u4e49\u5e2e\u4f60\u8865\u201c\u8fd4\u56de\u5024\u201d\u548c\u201c\u4f5c\u7528\u57df\u201d\uff0c\u518d\u7ed9\u4f60 5 \u9898\u77ed\u7ec3\u4e60\u786e\u8ba4\u662f\u5426\u8865\u4e0a\u4e86\u3002',\n    standard: '\u8fbe\u6807\u8def\u5f84\u6700\u6807\u51c6\u3002\u5148\u5b8c\u6210\u5f53\u524d\u8282\u70b9\u7406\u89e3\uff0c\u518d\u505a 8 \u9898\u7ec3\u4e60\uff0c\u8fc7\u7ebf\u540e\u76f4\u63a5\u8fdb\u5165\u6a21\u5757\u5bfc\u5165\u3002',\n    goal: '\u76ee\u6807\u8def\u5f84\u66f4\u504f\u7ed3\u679c\u5bfc\u5411\u3002\u6211\u4f1a\u5148\u4fdd\u7559\u5fc5\u8981\u8865\u5f3a\uff0c\u518d\u628a\u540e\u9762\u7684\u8282\u70b9\u6309\u4f60\u7684\u76ee\u6807\u91cd\u6392\u3002'\n  };\n  function setActiveBranch(branch) {\n    pathBranches.forEach(item => item.classList.toggle('active', item.dataset.branch === branch));\n    branchPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.branchPanel === branch));\n  }\n  pathBranches.forEach(branch => {\n    branch.addEventListener('click', () => setActiveBranch(branch.dataset.branch));\n  });\n  document.querySelectorAll('.branch-node').forEach(node => {\n    node.addEventListener('click', () => setActiveBranch(node.dataset.branch));\n  });"

new = "  const branchPanels = document.querySelectorAll('.branch-panel');\n  const pathBranchAdvice = {\n    weak: '\u5148\u8d70\u8865\u5f31\u8def\u5f84\u66f4\u7a33\u3002\u6211\u4f1a\u5148\u7528\u77ed\u8bb2\u4e49\u5e2e\u4f60\u8865\u201c\u8fd4\u56de\u5024\u201d\u548c\u201c\u4f5c\u7528\u57df\u201d\uff0c\u518d\u7ed9\u4f60 5 \u9898\u77ed\u7ec3\u4e60\u786e\u8ba4\u662f\u5426\u8865\u4e0a\u4e86\u3002',\n    standard: '\u8fbe\u6807\u8def\u5f84\u6700\u6807\u51c6\u3002\u5148\u5b8c\u6210\u5f53\u524d\u8282\u70b9\u7406\u89e3\uff0c\u518d\u505a 8 \u9898\u7ec3\u4e60\uff0c\u8fc7\u7ebf\u540e\u76f4\u63a5\u8fdb\u5165\u6a21\u5757\u5bfc\u5165\u3002',\n    goal: '\u76ee\u6807\u8def\u5f84\u66f4\u504f\u7ed3\u679c\u5bfc\u5411\u3002\u6211\u4f1a\u5148\u4fdd\u7559\u5fc5\u8981\u8865\u5f3a\uff0c\u518d\u628a\u540e\u9762\u7684\u8282\u70b9\u6309\u4f60\u7684\u76ee\u6807\u91cd\u6392\u3002'\n  };\n  const colToBranch = { weak: 'weak', std: 'standard', goal: 'goal' };\n  function setActiveBranch(branch) {\n    branchPanels.forEach(panel => panel.classList.toggle('active', panel.dataset.branchPanel === branch));\n  }\n  document.querySelectorAll('.nav-path-col').forEach(col => {\n    const branchKey = Array.from(col.classList).find(c => colToBranch[c]);\n    if (branchKey) {\n      col.style.cursor = 'pointer';\n      col.addEventListener('click', () => setActiveBranch(colToBranch[branchKey]));\n    }\n  });"

if old in content:
    content = content.replace(old, new, 1)
    with open(r'D:\Project_building\SparkLearn\ui-prototypes\phase2-complete-ui\学而思 SparkLearn 全页面学习闭环原型.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: JS block replaced')
else:
    print('NOT FOUND - checking partial match...')
    # Try to find what's actually there
    idx = content.find("const pathBranches")
    if idx >= 0:
        print('Found pathBranches at:', idx)
        print(repr(content[idx:idx+400]))
    else:
        print('pathBranches not found at all')
