// ============================================================
// Ledger — telegram links controller
// ============================================================
const linkService = require("../services/telegram_link.service");

exports.list = async (req, res) => {
  const links = await linkService.listLinks(req.token);
  res.json({ links });
};

exports.create = async (req, res) => {
  const link = await linkService.createLink(req.token, {
    chat_id: req.body.chat_id,
    label: req.body.label,
    user_id: req.user.id,
  });
  res.status(201).json({ link });
};

exports.update = async (req, res) => {
  const link = await linkService.updateLink(req.token, req.params.id, {
    label: req.body.label,
  });
  if (!link) return res.status(404).json({ error: "Link not found." });
  res.json({ link });
};

exports.remove = async (req, res) => {
  await linkService.deleteLink(req.token, req.params.id);
  res.json({ deleted: req.params.id });
};
