/**
 * 项目创建表单共享类型定义
 */

/** 项目创建请求的数据结构 */
export interface CreateProjectPayload {
    name: string;
    type: 'worker' | 'pages';
    port?: number;
    code?: string;
    filename?: string;
    mainFile?: string;
    bindings: { kv: []; d1: []; r2: [] };
    envVars: Record<string, never>;
    buildId?: string;
    outputDir?: string;
    buildCommand?: string;
    deployCommand?: string;
}

/** 子表单组件通过 ref 暴露的方法 */
export interface SubFormHandle {
    /**
     * 获取子表单的数据，返回 null 表示校验失败
     * 校验失败时子组件内部通过 setError 反馈错误信息
     */
    getPayload: () => Promise<Partial<CreateProjectPayload> | null>;
}

/** 子表单组件的通用 Props */
export interface SubFormProps {
    /** 设置错误提示（向父组件传递） */
    setError: (msg: string) => void;
    /** Toast 提示 */
    showToast: (msg: string, type?: 'success' | 'error') => void;
}
