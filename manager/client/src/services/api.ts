/**
 * 统一的 API 客户端
 * 重新导出根目录的 api.ts，避免代码重复
 */
export {
    api as default,
    checkAuth,
    logout,
    authenticatedFetch
} from '../api';
