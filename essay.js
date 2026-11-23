/* 简答题模块 · 零依赖，独立于刷题逻辑：列表 + 题目/答案预览 */
(function () {
  'use strict';

  var DATA = Array.isArray(window.ESSAY_DATA) ? window.ESSAY_DATA : [];
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var VIEWS = ['Home', 'Quiz', 'Result', 'Report', 'Fav', 'Essay', 'EssayDetail'];

  var state = {
    filter: 'all',      // 'all' 或某个 category
    index: 0,           // 在当前筛选列表中的下标
    showAnswer: true,   // 默认直接展示题目与答案，可一键隐藏自测
    highlight: true     // 答案核心术语高亮，可一键关闭
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- AI 核心术语高亮 ----------------
     按备考记忆维度分 4 组，每组一种颜色；答案渲染时对命中词上色。
     words 为 [术语, 备考释义] 二元组：释义聚焦「AI 训练师」考点——是什么/考什么/怎么用。
     新增词条只需往对应 words 追加 [词, 解释]。 */
  var KW_GROUPS = [
    {
      cls: 'kw-flow', label: '数据处理', words: [
        ['数据清洗', '剔除噪声、重复、缺失与异常记录，保证数据可靠可用。数据质量是建模前置门槛，高频考点。'],
        ['数据预处理', '建模前对原始数据做清洗、转换、归一化等统一处理，使数据满足模型输入要求。'],
        ['预处理', '数据进入模型前的加工环节，含清洗、编码、标准化等，直接决定特征质量。'],
        ['特征工程', '从原始数据中构造、选择、变换特征的过程，是提升模型效果最有效的手段，备考核心。'],
        ['特征构造', '结合领域知识或自动方法生成新特征，补充原始字段未表达的信息。'],
        ['特征选择', '从特征集中挑出对目标最有用的子集，降维、去冗余、防过拟合。常考过滤/包裹/嵌入三类方法。'],
        ['特征提取', '通过变换把原始数据映射为更具代表性的特征，如图像提取边缘、文本提取词向量。'],
        ['特征交叉', '把两个或多个特征组合成新特征（如年龄×收入），捕捉特征间的交互关系。'],
        ['数据标准化', '把特征按比例缩放到统一量纲，消除量纲差异对距离/梯度类模型的影响。'],
        ['标准化', '常见为 Z-score（零均值单位方差），适用于岭回归、SVM、K-Means 等距离敏感模型。'],
        ['零均值标准化', '即 Z-score：减均值除以标准差，转换后均值为 0、方差为 1。'],
        ['缺失值处理', '对空值做删除、填充（均值/中位数/众数）或标记，避免模型报错或偏差。'],
        ['缺失值', '数据中缺失的字段值，需按缺失比例与业务含义选择删除或填充策略。'],
        ['异常值处理', '识别并处置偏离正常范围的点，可用盖帽法、分箱或删除，防止拉偏模型。'],
        ['异常值', '显著偏离整体分布的样本，可能是噪声也可能是关键事件，需结合业务判断。'],
        ['去重', '删除重复记录，防止同一信息被重复训练导致模型偏向与评估虚高。'],
        ['数据标注', '为样本打上监督学习所需的标签；主动学习优先标注模型不确定度高的样本以提效。'],
        ['标注', '给数据附加标签的过程，标注质量直接决定监督学习上限。'],
        ['数据增强', '通过同义词替换、句式重构、图像翻转等手段扩充样本，缓解小样本与过拟合。'],
        ['数据拆分', '按比例划分训练集/验证集/测试集（如 8:2），保证评估客观、防止数据泄漏。'],
        ['数据探索', '用描述性统计与可视化了解分布、缺失、异常和相关性，是建模前的必经步骤。'],
        ['数据向量化', '把文本、类别等非数值数据转成模型可计算的数值向量/矩阵表示。'],
        ['数据质量', '完整性、准确性、一致性、时效性的综合度量，劣质数据会让再好的模型失效。'],
        ['数据漂移', '线上数据分布相对训练时发生变化，导致模型效果衰减，需监控并定期重训。'],
        ['降噪', '滤除数据中的随机干扰信号，提升信噪比，常见如图像滤波、语音降噪。'],
        ['去噪', '与降噪同义，去掉噪声成分保留有效信息。'],
        ['多源数据', '来自不同系统或渠道的数据（如日志、社交、档案），融合可补全画像但需统一口径。'],
        ['数据融合', '整合多来源数据形成统一视图，关键是实体对齐与格式/接口标准化。'],
        ['数据治理', '对数据资产的全生命周期管理，含标准、质量、安全、血缘与权限。'],
        ['数据闭环', '数据采集→处理→建模→反馈→再优化的循环，让系统能持续迭代自我改进。'],
        ['闭环治理', '把监控发现的问题回流到处理规则中持续修正，形成质量治理闭环。'],
        ['数据孤岛', '各系统数据彼此隔离无法共享，需通过数据中台/统一接口打通。'],
        ['数据采集', '从传感器、日志、表单等源头获取原始数据，是整条数据链路的起点。'],
        ['数据接入', '把外部或新数据源引入处理管线，需定义格式、协议与频率。'],
        ['独热编码', 'One-Hot：把类别变量展成多个 0/1 列，避免引入虚假的大小顺序关系。'],
        ['目标编码', '用该类别对应目标变量的统计量（如均值）替代类别值，适合高基数特征，须防泄漏。'],
        ['标签编码', '给每个类别分配一个整数编号，适合有序类别，无序类别慎用以免引入伪顺序。'],
        ['分箱', '把连续值切成若干区间（等宽/等频），可处理非线性、增强可解释性。'],
        ['特征编码', '把非数值特征转换为数值形式的过程，是模型输入前的必要步骤。'],
        ['主成分分析', 'PCA：正交变换把相关特征投影为少数互不相关的主成分，保留最大方差，用于降维。'],
        ['PCA', '主成分分析，无监督线性降维方法，常考"保留多少方差/主成分数选择"。'],
        ['线性降维', '通过线性投影减少特征维度，代表方法 PCA、LDA，可降低计算量与共线性。'],
        ['中值滤波', '用邻域中值替代像素值，对椒盐噪声抑制效果好且保边缘。'],
        ['椒盐噪声', '图像中随机出现的黑白亮点，常用中值滤波去除。'],
        ['直方图均衡化', '通过调整像素分布增强图像对比度，改善过暗/过曝图像的质量。'],
        ['多帧融合', '融合连续多帧图像信息以去模糊、提质量，常用于视频与监控场景。'],
        ['关键点对齐', '检测人脸关键点后做仿射变换统一姿态，提升后续识别准确率。'],
        ['人脸对齐', '把检测到的人脸归一化到标准位置/角度，是识别前的标准预处理。'],
        ['ROI提取', 'Region of Interest，裁剪出感兴趣区域，减少无关背景对模型的干扰。'],
        ['全链路', '从数据采集到建模上线监控的端到端流程，训练师须具备全局视角。'],
        ['描述性统计', '均值、方差、分位数等统计量，快速刻画数据分布与异常。'],
        ['交叉验证', '如 K 折交叉验证，轮换训练/验证以稳健评估模型，小数据集尤其重要。'],
        ['A/B测试', '把流量分两组对比策略效果，用统计显著性验证改动是否真的有效。'],
        ['数据加密', '对存储与传输中的数据加密，防止泄露，满足安全合规要求。'],
        ['加密存储', '以密文形式落库，配合密钥管理保障静态数据安全。'],
        ['数据保护', '涵盖访问控制、脱敏、加密等措施，保护隐私与数据安全。'],
        ['质量监控', '持续跟踪缺失率、异常比例、覆盖率等指标，发现数据质量退化及时告警。'],
        ['数据可靠性', '数据准确、完整、可追溯的程度，是业务决策可信的前提。']
      ]
    },
    {
      cls: 'kw-model', label: '模型算法', words: [
        ['机器学习模型', '从数据中学习规律并做预测的算法集合，训练师需掌握选型、训练、评估全流程。'],
        ['深度学习模型', '基于多层神经网络的模型，擅长图像、语音、文本等复杂非结构化数据。'],
        ['深度模型', '深层神经网络的简称，表达能力强但需更多数据与算力。'],
        ['轻量级模型', '参数少、推理快的模型，适合端侧或高并发实时场景。'],
        ['神经网络', '由多层神经元组成的非线性模型，靠反向传播更新权重，是深度学习基础。'],
        ['线性回归', '用线性方程拟合自变量与连续目标的关系，可解释性强，是回归baseline。'],
        ['LinearRegression', 'scikit-learn 的线性回归类，fit 拟合、score 返回 R²、predict 做预测。'],
        ['逻辑回归', '用 Sigmoid 把线性输出映射为概率，用于二分类，系数可解释胜率比。'],
        ['决策树', '按特征阈值递归划分的树形模型，可解释性强，需防过拟合（剪枝/限深）。'],
        ['XGBoost', '梯度提升树的高效实现，性能好、支持正则，是结构化数据竞赛常用强模型。'],
        ['Lasso', 'L1 正则线性回归，能把不重要特征系数压到 0，自带特征选择。'],
        ['K-Means', '经典聚类算法：迭代更新质心把样本划到 K 个簇，需预设 K 并做标准化。'],
        ['KMeans', '同 K-Means，scikit-learn 中对应 KMeans 类。'],
        ['聚类算法', '无监督地把相似样本归为一类，如 K-Means、层次聚类、DBSCAN。'],
        ['聚类', '无监督分组任务，簇内相似、簇间相异，考 K 值选择与效果评估。'],
        ['混淆矩阵', '列出 TP/FP/TN/FN 的矩阵，是精确率、召回率、F1 等指标的基础。'],
        ['Transformer', '基于自注意力的序列模型，捕捉长距离依赖，是 NLP 大模型主流架构。'],
        ['序列建模', '对有时间/顺序关系的数据建模，捕捉前后依赖，如用户连续行为预测。'],
        ['NLP', '自然语言处理，让机器理解与生成文本，涵盖分词、意图识别、语义分析等。'],
        ['知识图谱', '以实体-关系三元组组织知识，支持语义推理与关联推荐。'],
        ['集成学习', '组合多个弱模型提升性能与稳定性，如 Bagging、Boosting、 stacking。'],
        ['多模型集成', '融合多个模型结果（投票/平均/ stacking），通常优于单一模型。'],
        ['规则引擎', '基于预设业务规则做判断的系统，可解释、可控，常与模型互补用于风控。'],
        ['风控模型', '用于识别欺诈与信用风险的模型，强调低误报、可解释与实时性。'],
        ['层次化建模', '按问题复杂度分层用不同模型处理，简单问题轻量模型、复杂问题深度模型。'],
        ['模型选型', '据任务类型、数据规模、可解释性与时延要求选择合适模型，是训练师核心能力。'],
        ['模型训练', '用训练数据优化模型参数以最小化损失函数的过程。'],
        ['持续训练', '上线后随新数据与分布变化定期重训，保持模型效果。'],
        ['模型微调', '在预训练模型基础上用少量领域数据再训练，低成本适配具体任务。'],
        ['模型复杂度', '模型容量/自由度，过低欠拟合、过高过拟合，需与数据量匹配。'],
        ['模型参数', '模型内部可学习的权重，由训练过程优化得到；区别于人工设定的超参数。'],
        ['模型结构', '网络的层数、连接方式等架构设计，决定模型表达能力。'],
        ['模型性能', '模型在准确率、速度、鲁棒性等方面的综合表现。'],
        ['迭代次数', '训练的轮数(epochs)，过少欠拟合、过多可能过拟合，配合早停使用。'],
        ['正则化', '约束模型复杂度以防过拟合，如 L1/L2、Dropout，提升泛化能力。'],
        ['学习率', '控制参数更新步长的超参数，过大不收敛、过小收敛慢，是调参重点。'],
        ['分类模型', '预测离散类别标签的模型，评估看准确率/精确率/召回率/F1/AUC。'],
        ['回归模型', '预测连续数值的模型，评估看 MSE/RMSE/MAE/R²。'],
        ['分类任务', '目标是判别样本属于哪个类别的任务，如欺诈识别、意图分类。'],
        ['建模', '把业务问题抽象为机器学习任务并选择算法训练模型的过程。'],
        ['拟合', '模型适配训练数据的程度，拟合不足为欠拟合，过度为过拟合。'],
        ['激活函数', '引入非线性使网络能拟合复杂关系，如 ReLU、Sigmoid、Tanh。'],
        ['目标函数', '训练时要优化的函数（损失+正则），定义模型的学习目标。'],
        ['优化器', '更新参数以最小化损失的算法，如 SGD、Adam。'],
        ['超参数', '训练前人工设定的参数（学习率、树深、K 值等），需调参搜索。']
      ]
    },
    {
      cls: 'kw-metric', label: '评估指标', words: [
        ['准确率', '预测正确的比例 (TP+TN)/总数；类别不平衡时会失真，不能只看它。'],
        ['精确率', '预测为正中真正为正的比例 TP/(TP+FP)，关注"查得准"，误报代价高时优先。'],
        ['召回率', '真实为正中被找回的比例 TP/(TP+FN)，关注"查得全"，漏报代价高时优先。'],
        ['查准率', '即精确率，强调预测结果中正确者的占比。'],
        ['查全率', '即召回率，强调所有正例被找出的比例。'],
        ['F1-score', '精确率与召回率的调和平均，综合二者，类别不平衡时比准确率更可靠。'],
        ['F1分数', '同 F1-score，兼顾查准与查全的单一综合指标。'],
        ['F1', '精确率与召回率调和平均，二者均衡时高。'],
        ['Macro Avg', '宏平均：各类别指标等权平均，重视小类表现。'],
        ['Weighted Avg', '加权平均：按各类样本数加权，样本不均衡时更贴近整体。'],
        ['Macro/Micro-average', '宏/微平均：宏对类别等权，微对样本等权，多分类评估常考。'],
        ['Macro', '宏平均，对所有类别一视同仁求均值，小类权重大。'],
        ['Micro', '微平均，汇总所有样本计算，大类主导。'],
        ['Top-k准确率', '预测前 k 个结果中包含正确类别即算命中，推荐/检索场景常用。'],
        ['对数损失', 'Log Loss：基于预测概率的负对数似然，越小越好， penalize 自信的错误。'],
        ['Brier分数', '衡量概率预测与真实结果偏差的均方误差，越小越好，评估概率校准。'],
        ['AUC', 'ROC 曲线下面积，衡量模型区分正负样本的能力，0.5 随机、越接近 1 越好。'],
        ['RMSE', '均方根误差，对大误差更敏感，量纲与目标一致，越小越好。'],
        ['MAPE', '平均绝对百分比误差，用百分比表示误差，便于跨量纲比较。'],
        ['MSLE', '均方对数误差，对数量级差异更鲁棒。'],
        ['MSE', '均方误差，预测值与真值差的平方均值，越小越好。'],
        ['MAE', '平均绝对误差，对异常值不如 MSE 敏感，更易解释。'],
        ['R²', '决定系数，模型解释的方差占比，0~1，越接近 1 拟合越好。'],
        ['r_squared', 'R² 的代码写法，score() 返回的即为它。'],
        ['决定系数', '同 R²，衡量模型对数据变异的解释能力。'],
        ['回归系数', '回归方程中特征的权重，绝对值越大影响越强，正负表示方向。'],
        ['轮廓系数', '聚类评估指标，取值 -1~1，越接近 1 表示簇内紧、簇间疏。'],
        ['簇内误差平方和', 'SSE/惯性，簇内样本到质心距离平方和，越小越紧，用肘部法选 K。'],
        ['肘部拐点', 'SSE 随 K 增大下降趋缓的拐点，据此选最优聚类数。'],
        ['拟合优度', '模型对观测数据的拟合程度，回归看 R²，越接近 1 越好。'],
        ['覆盖率', '推荐/检索中内容被曝光或触达的比例，衡量多样性与长尾挖掘。'],
        ['命中率', '推荐结果中用户实际点击/购买的比例，衡量推荐准确度。'],
        ['满意度', '用户主观评价（评分、完播、反馈），衡量体验的综合指标。'],
        ['完播率', '看完内容的用户占比，视频/直播场景衡量内容吸引力。'],
        ['点击率', 'CTR，点击数/曝光数，衡量推荐或广告吸引用户的能力。'],
        ['置信度', '模型对预测结果的确定程度，低置信度可触发人工复核或二次核验。'],
        ['相关性', '两变量共同变化的程度，特征与标签强相关才更有预测价值。'],
        ['相关系数', '皮尔逊系数等，取值 -1~1，绝对值越大相关性越强；高相关需防共线性。'],
        ['评估指标', '衡量模型好坏的量化标准，分类/回归/聚类各有对应指标体系。'],
        ['指标体系', '多个指标组合评估，避免单一指标片面，如准确率+F1+AUC。'],
        ['泛化能力', '模型在未见过数据上的表现，是训练的最终目标，靠正则与交叉验证保障。'],
        ['鲁棒性', '模型对噪声、异常、分布变化的稳定程度，越强越可靠。']
      ]
    },
    {
      cls: 'kw-scene', label: '业务场景', words: [
        ['智能客服', '用 NLP+知识库自动应答的客服系统，考点在意图识别、实时响应与数据闭环优化。'],
        ['智能推荐', '基于用户行为与内容特征做个性化分发，核心是召回、排序与效果评估。'],
        ['精准推荐', '面向个体偏好精准匹配内容，缓解信息过载与长尾挖掘问题。'],
        ['个性化推荐', '依据用户画像与历史行为定制推荐结果，提升点击率与满意度。'],
        ['用户画像', '用标签刻画用户属性与偏好，是推荐、分群、营销的基础。'],
        ['意图识别', '判断用户真实需求类别，是对话系统的关键环节，考点在准确率与多意图拆分。'],
        ['语义识别', '理解文本背后的含义而非字面匹配，依赖 NLP 模型与词向量。'],
        ['语义解析', '把自然语言转为结构化表示，支撑检索、问答与指令执行。'],
        ['精准营销', '基于用户分群与画像定向触达，提高转化、降低成本。'],
        ['用户分群', '按价值/行为把用户聚类分层（如 RFM/L-PRFS），支撑差异化运营。'],
        ['用户生命周期', '用户从注册、活跃、流失到召回的全过程，按阶段制定运营策略。'],
        ['异常检测', '识别偏离正常模式的样本，用于风控、设备故障、欺诈识别。'],
        ['交易欺诈', '识别异常交易行为，强调低误报、高召回与实时拦截。'],
        ['金融风控', '用规则+模型防控信用风险与欺诈，兼顾效果、可解释与合规。'],
        ['智慧安防', '结合人脸识别与视频分析做门禁、布控、预警的安全体系。'],
        ['人脸识别', '提取人脸特征并与底库比对完成身份核验，考点在预处理与鲁棒性。'],
        ['活体检测', '判别是真人还是照片/视频攻击，保障身份认证安全。'],
        ['门禁通行', '通过人脸/卡/码核验身份后放行，强调实时性与准确率。'],
        ['智慧园区', '融合 IoT、数字孪生、5G 的园区智能化管理，考点在多端交互与数据决策。'],
        ['数字孪生', '物理实体的数字映射，实时同步状态用于监控、仿真与优化。'],
        ['边缘计算', '在靠近数据源的边缘侧处理，降低时延、减少带宽，适合实时场景。'],
        ['物联网', 'IoT，设备互联采集数据，是智慧园区/工业检测的数据来源。'],
        ['IoT', '物联网英文缩写，指物物相连的网络与终端采集体系。'],
        ['个性化服务', '按用户特征定制内容与功能，提升体验与粘性。'],
        ['用户体验', '用户使用系统的整体感受，通过满意度、流畅度等衡量。'],
        ['实时响应', '系统低延迟给出结果，高并发场景需缓存、轻量模型与异步优化。'],
        ['高并发', '大量请求同时到达，需分布式、缓存、限流与异步处理保障吞吐。'],
        ['隐私保护', '最小化采集、脱敏与授权使用个人数据，防止泄露。'],
        ['隐私合规', '遵循个人信息保护法规，明确告知同意与使用边界，是上线硬约束。'],
        ['数据安全', '保障数据保密性、完整性、可用性，含加密、权限、审计。'],
        ['数据安全合规', '同时满足安全防护与法规要求，涉及存储、传输、使用全环节。'],
        ['智能分配', '基于规则把任务自动派给最优执行方，如订单分配仓库/药师。'],
        ['订单闭环', '订单从创建到完成的状态流转与数据回写，保证全流程可追踪。'],
        ['服务闭环', '需求收集→处理→反馈→优化的循环，确保问题被解决并持续改进。'],
        ['知识库', '结构化存储领域知识，支撑问答检索与可解释应答。'],
        ['语义级推荐', '基于实体与语义关联（如知识图谱）推荐，超越关键词匹配。'],
        ['跨域信息迁移', '把其他领域/平台的信息用于冷启动画像，缓解数据稀疏。'],
        ['兴趣向量', '把用户兴趣编码成向量，便于相似度计算与个性化匹配。'],
        ['满意度评估', '用评分、完播、反馈衡量用户对结果的主观认可度。'],
        ['数据决策', '以数据分析结论驱动业务策略，而非凭经验拍板。'],
        ['语音识别', 'ASR，把语音转为文本，考点在噪声、方言与口音的鲁棒处理。'],
        ['语音控制', '用语音指令操控设备，流程为唤醒→收音→语义识别→执行→反馈。'],
        ['移动终端', '手机/平板等端侧设备，常作为控制入口与状态同步载体。'],
        ['身份绑定', '把用户账号与设备/身份关联，用于权限与个性化服务，需防冲突。'],
        ['降噪算法', '抑制环境噪声提升语音/图像质量，如自适应滤波、波束成形。'],
        ['方言模型', '针对方言/口音优化的模型，提升特定人群识别准确率。'],
        ['离线缓存', '无网或弱网时本地暂存数据与操作，恢复后再同步，提升可用性。'],
        ['优先级队列', '按紧急/重要程度排序处理请求，保障关键任务优先响应。'],
        ['异步生成', '把耗时任务放到后台生成再推送结果，避免阻塞主线程。'],
        ['探索模式', '在推荐中故意引入随机新内容，打破信息茧房、发现潜在兴趣。'],
        ['隐私设置', '让用户自主控制数据收集与使用范围，是合规与信任的基础。'],
        ['分级响应', '按问题严重程度分配处理优先级与策略，如技术故障优先。'],
        ['人机交互', '用户与系统之间的信息交换方式，设计要流畅、低学习成本。'],
        ['交互流程', '用户操作步骤与系统响应的序列，训练师需能拆解环节与潜在风险。'],
        ['实时调控', '在运行中动态调整参数（音效、灯光等），要求低延迟与状态同步。'],
        ['并发请求', '同一时刻大量用户操作，需限流、队列与动态资源分配。'],
        ['动态分配', '按当前负载与优先级动态调度控制权或资源，避免冲突。']
      ]
    }
  ];

  /* 构建 词 -> {cls,label,tip} 映射；按长度降序拼成单个正则，长词优先且只替换一次 */
  var KW_MAP = (function () {
    var lower = {}, all = [];
    KW_GROUPS.forEach(function (g) {
      g.words.forEach(function (pair) {
        var w = pair[0];
        lower[w.toLowerCase()] = { cls: g.cls, label: g.label, tip: pair[1] };
        all.push(w);
      });
    });
    all.sort(function (a, b) { return b.length - a.length; });
    var escaped = all.map(function (w) {
      return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    var re = new RegExp('(' + escaped.join('|') + ')', 'gi');
    return { lower: lower, re: re };
  })();

  function highlightKeywords(text) {
    return text.replace(KW_MAP.re, function (m) {
      var hit = KW_MAP.lower[m.toLowerCase()];
      if (!hit) return m;
      return '<mark class="essay-kw ' + hit.cls + ' has-tip" data-tip="' +
        esc(hit.tip) + '" data-label="' + esc(hit.label) + '">' + m + '</mark>';
    });
  }

  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function showView(name) {
    VIEWS.forEach(function (v) {
      var el = $('#view' + v);
      if (el) el.classList.toggle('hidden', v !== name);
    });
    window.scrollTo(0, 0);
  }

  function openLightbox(src, alt) {
    closeLightbox();
    var box = document.createElement('div');
    box.id = 'essayLightbox';
    box.className = 'essay-lightbox';
    box.innerHTML = '<button class="essay-lightbox-close" aria-label="关闭">×</button>' +
      '<img src="' + src + '" alt="' + (alt || '') + '">' +
      '<div class="essay-lightbox-cap">点击任意处关闭</div>';
    document.body.appendChild(box);
  }
  function closeLightbox() {
    var box = document.getElementById('essayLightbox');
    if (box && box.parentNode) box.parentNode.removeChild(box);
  }

  /* ---------------- 术语释义浮层 ---------------- */
  function closeTip() {
    var box = document.getElementById('essayTip');
    if (box && box.parentNode) box.parentNode.removeChild(box);
  }

  function openTip(mark) {
    closeTip();
    var tip = mark.getAttribute('data-tip') || '';
    var label = mark.getAttribute('data-label') || '';
    var cls = mark.getAttribute('class') || '';
    var kindCls = (cls.match(/\bkw-(flow|model|metric|scene)\b/) || [])[0] || 'kw-flow';
    var word = mark.textContent;

    var box = document.createElement('div');
    box.id = 'essayTip';
    box.className = 'essay-tip';
    box.innerHTML =
      '<div class="essay-tip-head">' +
        '<span class="essay-kw ' + kindCls + '">' + esc(word) + '</span>' +
        '<span class="essay-tip-label">' + esc(label) + '</span>' +
        '<button class="essay-tip-close" aria-label="关闭">×</button>' +
      '</div>' +
      '<div class="essay-tip-body">' + esc(tip) + '</div>' +
      '<div class="essay-tip-foot">AI 训练师备考知识点 · 点击空白处关闭</div>';

    /* 定位：优先显示在词上方，空间不足则下方；左右不越界 */
    var r = mark.getBoundingClientRect();
    document.body.appendChild(box);
    var bw = box.offsetWidth, bh = box.offsetHeight;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - bw / 2), window.innerWidth - bw - 8);
    var top = r.top - bh - 10;
    if (top < 8) top = r.bottom + 10;
    box.style.left = left + 'px';
    if (window.scrollY) top += window.scrollY;
    box.style.top = top + 'px';
  }

  /* 按出现顺序去重得到主题分类 */
  function categories() {
    var seen = {}, out = [];
    DATA.forEach(function (q) {
      var c = q.category || '简答题';
      if (!seen[c]) { seen[c] = 1; out.push(c); }
    });
    return out;
  }

  function pool() {
    return state.filter === 'all'
      ? DATA
      : DATA.filter(function (q) { return (q.category || '简答题') === state.filter; });
  }

  function preview(text, n) {
    var t = String(text || '').replace(/\[\[IMG:[^\]]+\]\]/g, '[图]').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  /* 题干/答案里的 [[IMG:文件名]] 标记渲染为可点击放大的图片
     highlight=true 时，对文本片段做核心术语高亮（图片标记先行剔除，避免误伤） */
  function richText(text, highlight) {
    var raw = String(text == null ? '' : text);
    var parts = raw.split(/(\[\[IMG:[^\]]+\]\])/g);
    return parts.map(function (part) {
      var m = /^\[\[IMG:([^\]]+)\]\]$/.exec(part);
      if (m) {
        var name = m[1];
        var src = 'images/essay/' + name;
        return '<figure class="essay-figure">' +
          '<img class="essay-img" src="' + src + '" alt="示意图 ' + esc(name) + '" ' +
          'data-src="' + src + '" loading="lazy">' +
          '<figcaption>示意图 · ' + esc(name) + '（点击放大）</figcaption>' +
          '</figure>';
      }
      var safe = esc(part);
      return highlight && state.highlight ? highlightKeywords(safe) : safe;
    }).join('');
  }

  /* ---------- 问题 / 答案逐条配对 ----------
     把题干与答案都按行首的「问题N：/任务N：/第N问：」切成段，按序号一一配对。
     无分段的整块题（如教学大纲、代码题）返回单段。 */
  function cn2num(s) {
    var m = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    return /^\d+$/.test(s) ? parseInt(s, 10) : (m[s] || 0);
  }
  var MAIN_RE = /(?:^|\n)[ \t]*(问题|任务)([一二三四五六七八九十\d]+)[：:]?[ \t]*(?=\n|$|\S)|(?:^|\n)[ \t]*(第)([一二三四五六七八九十\d]+)(问)[：:]?[ \t]*(?=\n|$|\S)/g;

  function splitByMain(text) {
    text = String(text || '');
    var pts = [], m;
    MAIN_RE.lastIndex = 0;
    while ((m = MAIN_RE.exec(text)) !== null) {
      var g = m[1] || m[3];
      var numStr = m[2] || m[4];
      var lead = m[0].charAt(0) === '\n' ? 1 : 0;
      /* 标记整体在原文中的结束位置，用于生成 head */
      var word = g + numStr + (m[5] || '');
      pts.push({ idx: m.index + lead, end: m.index + m[0].length, word: word, num: cn2num(numStr) });
    }
    if (!pts.length) return null;
    return pts.map(function (p, i) {
      var end = (i + 1 < pts.length) ? pts[i + 1].idx : text.length;
      var seg = text.slice(p.idx, end);
      var firstNl = seg.indexOf('\n');
      /* head = 标记所在首行；body = 其后所有行（避免首行内容重复） */
      var headLine = (firstNl >= 0 ? seg.slice(0, firstNl) : seg).trim();
      var body = (firstNl >= 0 ? seg.slice(firstNl + 1) : '').trim();
      return { num: p.num, head: headLine || p.word, body: body };
    });
  }

  /* 生成逐条交错的「问题 → 答案」结构；背景段单独返回 */
  function buildPairs(q) {
    var stem = String(q.stem || '');
    var qs = splitByMain(stem);
    var as = splitByMain(q.answer);
    var background = '';

    if (!qs) {
      /* 无问题分段：整题作为一组，题干即问题 */
      background = '';
      return { background: background, pairs: [{ q: stem, a: q.answer, whole: true }] };
    }

    /* 第一个标记之前为背景描述 */
    var firstMatch = MAIN_RE.exec(stem);
    MAIN_RE.lastIndex = 0;
    /* 用 qs 的 head 在 stem 中定位第一段起点来切背景 */
    var firstIdx = stem.indexOf(qs[0].head.split(/[：:]/)[0]);
    if (firstIdx > 0) background = stem.slice(0, firstIdx).trim();

    var pairs = qs.map(function (seg, i) {
      var ans = as && as[i] ? as[i] : null;
      var qText = seg.head + (seg.body ? '\n' + seg.body : '');
      /* 答案段首行的编号标记（第一问：/问题一）因徽章已标明序号，去掉避免重复 */
      var aHead = ans ? ans.head.replace(/^(问题|任务|第)[一二三四五六七八九十\d]+\s*问?\s*[：:]?\s*/, '') : '';
      var aText = ans ? (aHead + (ans.body ? '\n' + ans.body : '')) : '';
      return { q: qText, a: aText.trim(), num: seg.num };
    });
    return { background: background, pairs: pairs };
  }

  /* 渲染题目背景（去掉问题分段后的纯背景） */
  function renderBackground(text) {
    if (!text) return '';
    return '<div class="essay-block">' +
      '<div class="essay-block-head"><span class="essay-block-tag">题目背景</span></div>' +
      '<div class="essay-content stem-text">' + richText(text) + '</div>' +
      '</div>';
  }

  /* 渲染逐条交错的问题-答案对 */
  function renderPairs(q) {
    var data = buildPairs(q);
    var html = renderBackground(data.background);
    data.pairs.forEach(function (p, i) {
      html += '<div class="essay-pair">' +
        '<div class="pair-q">' +
          '<span class="pair-badge">问题' + (p.num || (i + 1)) + '</span>' +
          '<div class="pair-q-text">' + richText(p.q, false) + '</div>' +
        '</div>' +
        '<div class="pair-a">' +
          '<div class="pair-a-head">参考答案</div>' +
          '<div class="essay-content answer-text">' + richText(p.a, true) + '</div>' +
        '</div>' +
      '</div>';
    });
    return html;
  }

  /* 颜色图例：帮助把四类颜色与备考维度对应起来 */
  function kwLegend() {
    return '<div class="essay-kw-legend">' +
      KW_GROUPS.map(function (g) {
        return '<span class="kw-legend-item"><i class="essay-kw ' + g.cls + '">' +
          g.label + '</i></span>';
      }).join('') +
      '</div>';
  }

  /* ---------------- 列表页 ---------------- */
  function renderList() {
    var cats = categories();
    $('#essayCountSub').textContent = '共 ' + DATA.length + ' 题 · ' + cats.length + ' 个主题';

    var chips = ['<button class="chip' + (state.filter === 'all' ? ' active' : '') +
      '" data-cat="all">全部 ' + DATA.length + '</button>'];
    cats.forEach(function (c) {
      var n = DATA.filter(function (q) { return (q.category || '简答题') === c; }).length;
      chips.push('<button class="chip' + (state.filter === c ? ' active' : '') +
        '" data-cat="' + esc(c) + '">' + esc(c) + ' ' + n + '</button>');
    });
    $('#essayChips').innerHTML = chips.join('');

    var list = pool();
    if (!list.length) {
      $('#essayList').innerHTML = '<p class="empty">该主题下暂无题目</p>';
      return;
    }
    $('#essayList').innerHTML = list.map(function (q, i) {
      var globalIndex = DATA.indexOf(q);
      return '<button class="essay-item" data-i="' + globalIndex + '">' +
        '<span class="essay-no">' + (i + 1) + '</span>' +
        '<span class="essay-item-main">' +
          '<span class="essay-item-top">' +
            '<span class="badge soft">' + esc(q.category || '简答题') + '</span>' +
            '<span class="essay-score">' + esc(q.score || '') + '</span>' +
          '</span>' +
          '<span class="essay-item-preview">' + esc(preview(q.stem, 70)) + '</span>' +
        '</span>' +
        '<span class="essay-item-arrow">›</span>' +
      '</button>';
    }).join('');
  }

  /* ---------------- 详情页 ---------------- */
  function currentListIndex() {
    var list = pool();
    var q = DATA[state.index];
    return list.indexOf(q);
  }

  function renderDetail() {
    closeTip();
    var list = pool();
    var li = currentListIndex();
    var q = DATA[state.index];
    if (!q || li < 0) { toast('题目数据异常'); return; }

    $('#essayDetailCounter').textContent = (li + 1) + ' / ' + list.length;
    $('#essayPrevBtn').disabled = li <= 0;
    $('#essayNextBtn').disabled = li >= list.length - 1;

    var kwBtn = '<button id="essayToggleKw" class="essay-toggle kw-toggle">' +
      (state.highlight ? '关闭高亮' : '开启高亮') + '</button>';

    var ansBlock = state.showAnswer
      ? '<div class="essay-pair-wrap">' +
          '<div class="essay-block-head">' +
            '<span class="essay-block-tag answer">参考答案 · 逐题对照</span>' +
            '<span class="essay-block-actions">' + kwBtn +
              '<button id="essayToggleAns" class="essay-toggle">隐藏参考答案</button></span>' +
          '</div>' +
          kwLegend() +
          renderPairs(q) +
        '</div>'
      : '<div class="essay-block">' +
          '<div class="essay-block-head"><span class="essay-block-tag answer">参考答案</span>' +
            '<button id="essayToggleAns" class="essay-toggle">显示参考答案</button></div>' +
          '<div class="essay-answer-mask" id="essayAnswerMask">答案已隐藏，点上方按钮展开查看</div>' +
        '</div>';

    $('#essayDetailBody').innerHTML =
      '<div class="essay-detail-card">' +
        '<div class="q-meta">' +
          '<span class="badge">简答题</span>' +
          '<span class="badge soft">' + esc(q.category || '简答题') + '</span>' +
          '<span class="badge soft">' + esc(q.score || '') + '</span>' +
          '<span class="q-num">#' + esc(q.id) + '</span>' +
        '</div>' +
        ansBlock +
      '</div>';
  }

  function openDetail(i) {
    state.index = i;
    state.showAnswer = true;
    showView('EssayDetail');
    renderDetail();
  }

  function step(delta) {
    var list = pool();
    var li = currentListIndex() + delta;
    if (li < 0 || li >= list.length) return;
    state.index = DATA.indexOf(list[li]);
    state.showAnswer = true;
    renderDetail();
    window.scrollTo(0, 0);
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $('#essayEntryBtn').addEventListener('click', function () {
      if (!DATA.length) { toast('简答题数据未加载'); return; }
      state.filter = 'all';
      state.index = 0;
      renderList();
      showView('Essay');
    });

    $('#essayBackBtn').addEventListener('click', function () { showView('Home'); });
    $('#essayDetailBackBtn').addEventListener('click', function () { renderList(); showView('Essay'); });

    $('#essayChips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      state.filter = b.dataset.cat;
      state.index = 0;
      renderList();
    });

    $('#essayList').addEventListener('click', function (e) {
      var b = e.target.closest('.essay-item');
      if (!b) return;
      openDetail(Number(b.dataset.i));
    });

    $('#essayDetailBody').addEventListener('click', function (e) {
      var img = e.target.closest('.essay-img');
      if (img) { openLightbox(img.getAttribute('data-src') || img.src, img.alt); return; }
      var mark = e.target.closest('mark.has-tip');
      if (mark) { openTip(mark); return; }
      if (e.target.closest('#essayToggleAns')) {
        state.showAnswer = !state.showAnswer;
        closeTip();
        renderDetail();
        return;
      }
      if (e.target.closest('#essayToggleKw')) {
        state.highlight = !state.highlight;
        closeTip();
        renderDetail();
      }
    });

    /* 图片放大预览 / 术语浮层：点击遮罩、关闭按钮或空白处关闭 */
    document.addEventListener('click', function (e) {
      if (e.target.closest('#essayLightbox')) { closeLightbox(); return; }
      if (e.target.closest('#essayTip')) {
        if (e.target.closest('.essay-tip-close')) closeTip();
        return;
      }
      // 点击非高亮词处关闭术语浮层（高亮词自身走详情页委托，不会到这里误关）
      if (!e.target.closest('mark.has-tip')) closeTip();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeLightbox(); closeTip(); }
    });
    window.addEventListener('scroll', closeTip, { passive: true });

    $('#essayPrevBtn').addEventListener('click', function () { step(-1); });
    $('#essayNextBtn').addEventListener('click', function () { step(1); });

    document.addEventListener('keydown', function (e) {
      if ($('#viewEssayDetail').classList.contains('hidden')) return;
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
      else if (e.key === 'a' || e.key === 'A') {
        state.showAnswer = !state.showAnswer; renderDetail(); e.preventDefault();
      }
    });
  }

  function init() {
    var sub = $('#essayEntrySub');
    if (sub) sub.textContent = '共 ' + DATA.length + ' 题 · 点开直接预览';
    bind();
  }

  if (DATA.length) init();
})();
