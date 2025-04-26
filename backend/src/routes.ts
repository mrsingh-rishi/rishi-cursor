import { Router} from 'express';
import { generateCode } from "./controller"

const router = Router();

router.post('/iterate', generateCode);

export default router;
