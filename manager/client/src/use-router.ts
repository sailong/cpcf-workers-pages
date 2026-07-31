import { useContext } from 'react';
import { RouterContext, type LocationState } from './router-context';

function useRouter() {
    const value = useContext(RouterContext);
    if (!value) throw new Error('Router context is missing');
    return value;
}

export const useNavigate = () => useRouter().navigate;

export const useLocation = (): LocationState => {
    const { pathname, state } = useRouter();
    return { pathname, state };
};
