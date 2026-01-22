
import { Router } from 'express';
import { PermissionController } from '../controllers/permission.controller';

const router = Router();
const permissionController = new PermissionController();

// List all available system permissions
router.get('/list', (req, res) => permissionController.getAllSystemPermissions(req, res));

router.get('/', (req, res) => permissionController.getPermissions(req, res));
router.post('/', (req, res) => permissionController.assignPermissions(req, res));
router.put('/', (req, res) => permissionController.updatePermissions(req, res));
router.delete('/', (req, res) => permissionController.deletePermissions(req, res));

export default router;
